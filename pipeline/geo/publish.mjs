// Publicación de la base geográfica:
//   npm run pipeline -- geo publish        D1 + R2
//   npm run pipeline -- geo publish d1     solo la base (D1 "geomastery-geo")
//   npm run pipeline -- geo publish r2     solo los archivos de las capas (R2 atlas/…)
//   npm run pipeline -- geo publish community   las guías (R2 community/…, con huella y manifiesto)
//   añade --dry para generar el SQL sin enviarlo
//
// D1: se genera data/geo-work/d1.sql (esquema + datos en INSERT de < 90 KB, el
// límite de D1 por sentencia es 100 KB) y se carga con wrangler. Las tablas se
// recrean enteras: la base es de solo lectura y se reconstruye en cada versión.
// R2: solo se suben los archivos cuyo hash cambió desde la última publicación.

import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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

const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' || typeof v === 'bigint' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

/** SQL completo para D1: DROP + esquema + INSERT por lotes (FTS incluida como filas normales). */
export async function exportSql(file = path.join(WORK, 'd1.sql')) {
  if (!existsSync(GEO_DB)) throw new Error('falta data/geo.db: npm run pipeline -- geo build')
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'entity_fts%'").all().map((r) => r.name)
  const out = createWriteStream(file)
  const write = (s) => new Promise((res) => (out.write(s) ? res() : out.once('drain', res)))
  for (const t of [...tables, 'entity_fts']) await write(`DROP TABLE IF EXISTS ${t};\n`)
  await write(readFileSync(SCHEMA, 'utf8').replace(/^--.*$/gm, '') + '\n')
  let rows = 0
  for (const t of [...tables, 'entity_fts']) {
    const cols = t === 'entity_fts' ? ['entity_id', 'names'] : db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name)
    const head = `INSERT INTO ${t} (${cols.join(', ')}) VALUES `
    let batch = []
    let size = head.length
    const flush = async () => {
      if (!batch.length) return
      await write(head + batch.join(',') + ';\n')
      batch = []
      size = head.length
    }
    // los esquemas de xref que solo usa el pipeline para unir fuentes no se publican
    const where = t === 'entity_xref' ? ` WHERE scheme IN (${PUBLIC_XREF.map(lit).join(', ')})` : ''
    for (const r of db.prepare(`SELECT ${cols.join(', ')} FROM ${t}${where}`).iterate()) {
      const v = `(${cols.map((c) => lit(r[c])).join(',')})`
      const bytes = Buffer.byteLength(v) + 1
      if (size + bytes > MAX_STATEMENT) await flush()
      batch.push(v)
      size += bytes
      rows++
    }
    await flush()
  }
  // estadísticas para el planificador (sin ellas, las consultas con varios índices van muy lentas)
  await write('PRAGMA optimize;\n')
  await new Promise((res) => out.end(res))
  db.close()
  return { file, rows, bytes: statSync(file).size }
}

function wrangler(args, opts = {}) {
  const token = env('CLOUDFLARE_API_TOKEN')
  const account = env('CLOUDFLARE_ACCOUNT_ID')
  if (!token || !account) throw new Error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en .env')
  return execFileSync('npx', ['--yes', 'wrangler@4', ...args], {
    cwd: WORKER_DIR, encoding: 'utf8', maxBuffer: 1 << 26, stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
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

async function publishD1(dry) {
  const t0 = Date.now()
  const { file, rows, bytes } = await exportSql()
  console.log(`[publish] SQL: ${rows} filas · ${(bytes / 1e6).toFixed(0)} MB → ${path.relative(ROOT, file)}`)
  if (dry) return
  const id = ensureD1()
  console.log(`[publish] D1 ${D1_NAME} (${id}): cargando…`)
  wrangler(['d1', 'execute', D1_NAME, '--remote', '--yes', `--file=${file}`], { inherit: true })
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
  // el manifiesto, al final: la app solo ve la versión nueva cuando ya está todo subido
  await put('community/manifest.json', Buffer.from(JSON.stringify(manifest)), 'application/json', 'public, max-age=60')
  console.log(`[publish] ✓ guías: ${done} archivos y el manifiesto`)
}

export async function publish(args) {
  const dry = args.includes('--dry')
  const what = args.filter((a) => !a.startsWith('--'))
  if (!what.length || what.includes('d1')) await publishD1(dry)
  if (!what.length || what.includes('r2')) await publishR2(dry)
  if (!what.length || what.includes('community')) await publishCommunity(dry)
  if (!dry) console.log('[publish] para servirlo: cd worker && npx wrangler deploy')
}
