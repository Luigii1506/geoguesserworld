// Publicación de la base geográfica:
//   npm run pipeline -- geo publish        todo: D1, R2 (capas y guías) y el Worker
//   npm run pipeline -- geo publish d1     solo la base (D1 "geomastery-geo")
//   npm run pipeline -- geo publish r2     solo los archivos de las capas (R2 atlas/…)
//   npm run pipeline -- geo publish community   las guías (R2 community/…, con huella y manifiesto)
//   npm run pipeline -- geo publish worker      despliega worker/ con la app de dist/ (wrangler deploy)
//   npm run pipeline -- geo publish secrets     sube los secretos del Worker desde .env
//   añade --dry para generar el SQL sin enviarlo y --full para recargar D1 entera
//
// D1: se genera data/geo-work/d1.sql y se carga con wrangler (sentencias de < 90 KB; el
// límite de D1 es 100 KB). Es incremental: se guarda una copia de lo publicado
// (data/geo-work/d1-published.db) y se envían solo las filas nuevas (INSERT), las que
// cambiaron (UPDATE de las columnas que cambian: D1 cobra cada índice que se toca) y las
// borradas (DELETE). Con otro esquema, o con --full, se borran y recrean todas las tablas
// (~3,3 M filas: más que el límite gratis de escrituras de un día).
// R2: solo se suben los archivos cuyo hash cambió desde la última publicación.

import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { ROOT } from '../lib/paths.mjs'
import { env } from '../lib/env.mjs'
import { r2 } from '../lib/r2.mjs'
import { ASSETS, WORK } from './lib/dirs.mjs'
import { GEO_DB } from './store.mjs'

const D1_NAME = 'geomastery-geo'
const WORKER_DIR = path.join(ROOT, 'worker')
const SCHEMA = path.join(ROOT, 'geo', 'schema.sql')
const MAX_STATEMENT = 90_000 // bytes
const PUBLIC_XREF = ['wd', 'gn', 'gvp', 'gmba', 'iso', 'iso3', 'ucdb', 'hylak', 'eco', 'ne']

// el \r se escribe como char(13): al leer el .sql por líneas se perdería
const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' || typeof v === 'bigint' ? String(v) : `'${String(v).replace(/'/g, "''").replace(/\r/g, "'||char(13)||'")}'`)

const SNAPSHOT = path.join(WORK, 'd1-published.db')
const CHUNK = 20_000  // textos más largos: se escriben por trozos

/** Escritor de SQL para D1: INSERT por lotes de < 90 KB y filas enormes completadas por trozos. */
function sqlWriter(file) {
  const out = createWriteStream(file)
  const write = (s) => new Promise((res) => (out.write(s) ? res() : out.once('drain', res)))
  let rows = 0
  const where = (pk, r) => pk.map((k) => `${k} = ${lit(r[k])}`).join(' AND ')
  const bigCols = (r, cols) => cols.filter((c) => typeof r[c] === 'string' && Buffer.byteLength(r[c]) > CHUNK)
  /** Completa los textos largos de una fila (ya escritos vacíos) con UPDATE … || '…' por trozos. */
  const append = async (t, pk, r, big) => {
    for (const c of big)
      for (let i = 0; i < r[c].length; i += CHUNK) await write(`UPDATE ${t} SET ${c} = ${c} || ${lit(r[c].slice(i, i + CHUNK))} WHERE ${where(pk, r)};\n`)
  }
  return {
    write,
    get rows() {
      return rows
    },
    /** Inserta (o reemplaza) filas de `t` con las columnas `cols`; `pk` para trocear las enormes. */
    async insert(t, cols, iterator, { replace = false, pk = [] } = {}) {
      const head = `${replace ? 'INSERT OR REPLACE' : 'INSERT'} INTO ${t} (${cols.join(', ')}) VALUES `
      let batch = []
      let size = head.length
      const flush = async () => {
        if (!batch.length) return
        await write(head + batch.join(',') + ';\n')
        batch = []
        size = head.length
      }
      for (const r of iterator) {
        const v = `(${cols.map((c) => lit(r[c])).join(',')})`
        // una fila más grande que el límite de D1 (una respuesta precalculada enorme): se inserta
        // con sus textos largos vacíos y se completa con UPDATE … || '…' por trozos
        if (Buffer.byteLength(v) > MAX_STATEMENT && pk.length) {
          await flush()
          const big = bigCols(r, cols)
          const first = { ...r }
          for (const c of big) first[c] = ''
          await write(`${head}(${cols.map((c) => lit(first[c])).join(',')});\n`)
          await append(t, pk, r, big)
          rows++
          continue
        }
        const bytes = Buffer.byteLength(v) + 1
        if (size + bytes > MAX_STATEMENT) await flush()
        batch.push(v)
        size += bytes
        rows++
      }
      await flush()
    },
    /**
     * Actualiza solo las columnas que cambiaron de una fila que ya existe. D1 cuenta como
     * escritura cada índice que toca: un INSERT OR REPLACE reescribe la fila y todos sus
     * índices (6 escrituras en entity); un UPDATE de columnas sin índice, una.
     */
    async update(t, pk, r, changed) {
      const big = bigCols(r, changed)
      await write(`UPDATE ${t} SET ${changed.map((c) => `${c} = ${big.includes(c) ? "''" : lit(r[c])}`).join(', ')} WHERE ${where(pk, r)};\n`)
      await append(t, pk, r, big)
      rows++
    },
    /** Borra las filas de `t` cuyas claves vienen en el iterador. */
    async remove(t, pk, iterator) {
      let batch = []
      let size = 0
      const head = pk.length === 1 ? `DELETE FROM ${t} WHERE ${pk[0]} IN (` : `DELETE FROM ${t} WHERE (${pk.join(', ')}) IN (VALUES `
      const flush = async () => {
        if (!batch.length) return
        await write(`${head}${batch.join(',')});\n`)
        batch = []
        size = 0
      }
      for (const r of iterator) {
        const v = pk.length === 1 ? lit(r[pk[0]]) : `(${pk.map((k) => lit(r[k])).join(',')})`
        if (size + v.length > MAX_STATEMENT - 200) await flush()
        batch.push(v)
        size += v.length + 1
        rows++
      }
      await flush()
    },
    end: () => new Promise((res) => out.end(res)),
  }
}

/** Tablas que se publican, con sus columnas, clave y filtro (FTS: por rowid, para conservar el orden). */
function tablesOf(db) {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'entity_fts%'").all().map((r) => r.name)
  return [
    ...names.map((t) => {
      const info = db.prepare(`PRAGMA table_info(${t})`).all()
      return {
        t, cols: info.map((c) => c.name), pk: info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name),
        // los esquemas de xref que solo usa el pipeline para unir fuentes no se publican
        where: t === 'entity_xref' ? `WHERE scheme IN (${PUBLIC_XREF.map(lit).join(', ')})` : '',
      }
    }),
    { t: 'entity_fts', cols: ['rowid', 'entity_id', 'names'], pk: ['rowid'], where: '' },
  ]
}

/** Esquema (para saber si una publicación incremental es posible). */
const schemaOf = (db) => db.prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE 'entity_fts_%' ORDER BY name").all().map((r) => `${r.type}|${r.name}|${r.sql}`).join('\n')

/**
 * SQL para D1. Completo: DROP + esquema + todas las filas. Incremental (si hay copia de lo
 * último publicado con el mismo esquema): solo filas nuevas o cambiadas y las borradas.
 */
export async function exportSql(file = path.join(WORK, 'd1.sql'), { full = false } = {}) {
  if (!existsSync(GEO_DB)) throw new Error('falta data/geo.db: npm run pipeline -- geo build')
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  let incremental = !full && existsSync(SNAPSHOT)
  if (incremental) {
    db.exec(`ATTACH DATABASE '${SNAPSHOT.replace(/'/g, "''")}' AS old`)
    const old = new DatabaseSync(SNAPSHOT, { readOnly: true })
    if (schemaOf(old) !== schemaOf(db)) incremental = false
    old.close()
  }
  const w = sqlWriter(file)
  const tables = tablesOf(db)
  if (incremental) {
    for (const { t, cols, pk, where } of tables) {
      const list = cols.join(', ')
      const keys = pk.join(', ')
      // filas distintas: las que ya existían se actualizan columna a columna; las nuevas se insertan
      const before = db.prepare(`SELECT ${list} FROM old.${t} WHERE ${pk.map((k) => `${k} = ?`).join(' AND ')}`)
      const fresh = []
      for (const r of db.prepare(`SELECT ${list} FROM main.${t} ${where} EXCEPT SELECT ${list} FROM old.${t} ${where}`).iterate()) {
        const o = before.get(...pk.map((k) => r[k]))
        if (o) await w.update(t, pk, r, cols.filter((c) => r[c] !== o[c]))
        else fresh.push(r)
      }
      await w.insert(t, cols, fresh, { replace: true, pk })
      await w.remove(t, pk, db.prepare(`SELECT ${keys} FROM old.${t} ${where} EXCEPT SELECT ${keys} FROM main.${t} ${where}`).iterate())
    }
  } else {
    for (const { t } of tables) await w.write(`DROP TABLE IF EXISTS ${t};\n`)
    await w.write(readFileSync(SCHEMA, 'utf8').replace(/^--.*$/gm, '') + '\n')
    for (const { t, cols, pk, where } of tables) await w.insert(t, cols, db.prepare(`SELECT ${cols.join(', ')} FROM ${t} ${where}`).iterate(), { pk })
  }
  // estadísticas para el planificador (sin ellas, las consultas con varios índices van muy lentas)
  await w.write('PRAGMA optimize;\n')
  await w.end()
  db.close()
  return { file, rows: w.rows, bytes: statSync(file).size, incremental }
}

/** Tras publicar, la copia de lo que hay en D1 (para la próxima publicación incremental). */
function saveSnapshot() {
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  rmSync(SNAPSHOT, { force: true })
  db.exec(`VACUUM INTO '${SNAPSHOT.replace(/'/g, "''")}'`)
  db.close()
}

function wrangler(args, opts = {}) {
  const token = env('CLOUDFLARE_API_TOKEN')
  const account = env('CLOUDFLARE_ACCOUNT_ID')
  if (!token || !account) throw new Error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en .env')
  return execFileSync('npx', ['--yes', 'wrangler@4', ...args], {
    cwd: WORKER_DIR, encoding: 'utf8', maxBuffer: 1 << 26, input: opts.input,
    stdio: opts.inherit ? 'inherit' : [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account },
  })
}

/** Id de la base D1 (la crea si no existe) y lo deja en worker/wrangler.toml. */
function ensureD1() {
  const list = JSON.parse(wrangler(['d1', 'list', '--json']))
  let db = list.find((d) => d.name === D1_NAME)
  if (!db) {
    wrangler(['d1', 'create', D1_NAME])
    db = JSON.parse(wrangler(['d1', 'list', '--json'])).find((d) => d.name === D1_NAME)
  }
  const toml = path.join(WORKER_DIR, 'wrangler.toml')
  const src = readFileSync(toml, 'utf8')
  const next = src.replace(/database_id = "[^"]*"/, `database_id = "${db.uuid}"`)
  if (next !== src) writeFileSync(toml, next)
  return db.uuid
}

async function publishD1(dry, { full = false } = {}) {
  const t0 = Date.now()
  const { file, rows, bytes, incremental } = await exportSql(undefined, { full })
  console.log(`[publish] SQL ${incremental ? 'incremental' : 'completo'}: ${rows} filas · ${(bytes / 1e6).toFixed(1)} MB → ${path.relative(ROOT, file)}`)
  if (dry) return
  if (incremental && rows === 0) return console.log('[publish] D1 ya está al día')
  const id = ensureD1()
  console.log(`[publish] D1 ${D1_NAME} (${id}): cargando…`)
  wrangler(['d1', 'execute', D1_NAME, '--remote', '--yes', `--file=${file}`], { inherit: true })
  saveSnapshot()
  writeFileSync(API_VERSION, Date.now().toString(36))
  console.log(`[publish] ✓ D1 en ${((Date.now() - t0) / 60000).toFixed(1)} min`)
}

const TYPES = { webp: 'image/webp', json: 'application/json', png: 'image/png' }

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

async function publishR2(dry) {
  const ledgerFile = path.join(WORK, 'r2-published.json')
  const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, 'utf8')) : {}
  const root = path.join(ASSETS, 'atlas')
  if (!existsSync(root)) return console.log('[publish] no hay capas (npm run pipeline -- geo layers)')
  const todo = []
  for (const file of walk(root)) {
    const key = path.relative(ASSETS, file).split(path.sep).join('/')
    const body = readFileSync(file)
    const hash = createHash('sha1').update(body).digest('hex')
    if (ledger[key] !== hash) todo.push({ key, body, hash })
  }
  console.log(`[publish] R2: ${todo.length} archivos nuevos o cambiados`)
  if (dry || !todo.length) return
  // las capas se regeneran con el mismo nombre: caché de una hora, no "immutable"
  const { put } = r2()
  let done = 0
  const queue = [...todo]
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (queue.length) {
      const f = queue.shift()
      await put(f.key, f.body, TYPES[f.key.split('.').pop()] ?? 'application/octet-stream', 'public, max-age=3600')
      ledger[f.key] = f.hash
      if (++done % 200 === 0) {
        console.log(`[publish] R2 ${done}/${todo.length}`)
        writeFileSync(ledgerFile, JSON.stringify(ledger))
      }
    }
  }))
  writeFileSync(ledgerFile, JSON.stringify(ledger))
  console.log(`[publish] ✓ R2: ${done} archivos`)
}

// datos de las guías que la app carga enteros (public/community → R2 community/…, con huella)
const COMMUNITY = path.join(ROOT, 'public', 'community')
// lo que ahora sirve la API (D1) o ya no usa la app
const COMMUNITY_SKIP = [/^visual-index\.json$/, /^quiz\.json$/, /^(plonkit|geohints|geometas)\//]

/** Versión de la base geográfica (fecha de construcción, en base 36). */
// Versión de lo que hay en D1 (va en las URLs de la API como ?v=): cambia cada vez que una
// publicación escribe filas. No basta con built_at: hay etapas (capas) que cambian la base
// sin reconstruirla.
const API_VERSION = path.join(WORK, 'd1-version.txt')
function apiVersion() {
  if (existsSync(API_VERSION)) return readFileSync(API_VERSION, 'utf8').trim()
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  const built = db.prepare("SELECT value FROM meta WHERE key = 'built_at'").get()?.value ?? new Date().toISOString()
  db.close()
  return Date.parse(built).toString(36)
}

async function publishCommunity(dry) {
  if (!existsSync(COMMUNITY)) return console.log('[publish] falta public/community (npm run pipeline -- export)')
  const ledgerFile = path.join(WORK, 'r2-community.json')
  const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, 'utf8')) : {}
  const manifest = {}
  const todo = []
  for (const file of walk(COMMUNITY)) {
    const rel = path.relative(COMMUNITY, file).split(path.sep).join('/')
    if (!rel.endsWith('.json') || COMMUNITY_SKIP.some((re) => re.test(rel))) continue
    const body = readFileSync(file)
    const hash = createHash('sha1').update(body).digest('hex').slice(0, 8)
    const hashed = rel.replace(/\.json$/, `.${hash}.json`)
    manifest[rel] = hashed
    if (!ledger[hashed]) todo.push({ key: `community/${hashed}`, body, hashed })
  }
  console.log(`[publish] guías: ${Object.keys(manifest).length} archivos · ${todo.length} nuevos o cambiados`)
  if (dry) return
  const { put } = r2()
  const queue = [...todo]
  let done = 0
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (queue.length) {
      const f = queue.shift()
      await put(f.key, f.body, 'application/json', 'public, max-age=31536000, immutable')
      ledger[f.hashed] = 1
      if (++done % 100 === 0) writeFileSync(ledgerFile, JSON.stringify(ledger))
    }
  }))
  writeFileSync(ledgerFile, JSON.stringify(ledger))
  // el manifiesto, al final: la app solo ve la versión nueva cuando ya está todo subido.
  // `_api` = versión de la base publicada en D1: la app la añade a la API (?v=) para que
  // el navegador guarde las respuestas hasta la próxima publicación
  manifest._api = apiVersion()
  await put('community/manifest.json', Buffer.from(JSON.stringify(manifest)), 'application/json', 'public, max-age=60')
  console.log(`[publish] ✓ guías: ${done} archivos y el manifiesto`)
}

// secretos del Worker que salen de .env (ACCESS_KEY es la clave de herramientas, VITE_IMAGE_KEY)
const SECRETS = { BETTER_AUTH_SECRET: 'BETTER_AUTH_SECRET', DATABASE_URL: 'DATABASE_URL', ALLOWED_EMAILS: 'ALLOWED_EMAILS', ACCESS_KEY: 'VITE_IMAGE_KEY' }

/** Sube a Cloudflare los secretos del Worker desde .env (nunca se imprimen). */
function publishSecrets() {
  for (const [name, from] of Object.entries(SECRETS)) {
    const value = env(from)
    if (!value) {
      console.warn(`[publish] ⚠ falta ${from} en .env: ${name} no se actualiza`)
      continue
    }
    wrangler(['secret', 'put', name], { input: value })
    console.log(`[publish] ✓ secreto ${name}`)
  }
}

export async function publish(args) {
  const dry = args.includes('--dry')
  const what = args.filter((a) => !a.startsWith('--'))
  if (!what.length || what.includes('d1')) await publishD1(dry, { full: args.includes('--full') })
  if (!what.length || what.includes('r2')) await publishR2(dry)
  // el manifiesto lleva la versión de D1: si se publica D1, también las guías (solo sube lo que cambió)
  if (!what.length || what.includes('community') || what.includes('d1')) await publishCommunity(dry)
  if (!dry && what.includes('secrets')) publishSecrets()
  if (!dry && (!what.length || what.includes('worker'))) {
    console.log('[publish] Worker: desplegando…')
    wrangler(['deploy'], { inherit: true })
  }
}
