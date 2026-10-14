// Resúmenes de Wikipedia (la introducción del artículo, en texto plano) de las
// entidades que tienen artículo pero aún no resumen: ciudades de GeoNames,
// regiones, cordilleras, lagos… Se piden de 20 en 20 y se guardan en caché.
//
//   npm run pipeline -- geo download wikipedia   (lee los artículos de la última data/geo.db)
//   npm run pipeline -- geo build                (los aplica)

import { DatabaseSync } from 'node:sqlite'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { rawDir, UA } from '../lib/files.mjs'
import { GEO_DB } from '../store.mjs'

export const meta = {
  id: 'wikipedia',
  name: 'Wikipedia (resúmenes)',
  url: 'https://www.wikipedia.org',
  license: 'CC BY-SA 4.0',
  attribution: 'Textos de Wikipedia, CC BY-SA 4.0',
}

const CACHE = () => path.join(rawDir('wikipedia'), 'extracts.jsonl')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MAX = 900

/** "https://es.wikipedia.org/wiki/T%C3%ADtulo" → ["es", "Título"] */
export function parseWiki(url) {
  const m = url?.match(/^https:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/)
  return m ? [m[1], decodeURIComponent(m[2]).replace(/_/g, ' ')] : null
}

function readCache() {
  const out = new Map()
  if (!existsSync(CACHE())) return out
  for (const l of readFileSync(CACHE(), 'utf8').split('\n')) {
    if (!l) continue
    const r = JSON.parse(l)
    out.set(`${r.lang}|${r.title}`, r.x)
  }
  return out
}

async function extracts(lang, titles) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exlimit: '20', redirects: '1',
        titles: titles.join('|'), format: 'json', formatversion: '2',
      })}`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) },
    ).catch(() => null)
    if (res?.ok) return res.json()
    await sleep((res?.status === 429 ? 20_000 : 3_000) * (attempt + 1))
  }
  return null
}

export async function download(ctx) {
  if (!existsSync(GEO_DB)) return ctx.log('aún no hay data/geo.db: ejecuta antes `geo build`')
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  const rows = db.prepare('SELECT wiki FROM entity WHERE wiki IS NOT NULL AND summary IS NULL ORDER BY rank DESC').all()
  db.close()
  const cache = readCache()
  const byLang = new Map()
  for (const r of rows) {
    const p = parseWiki(r.wiki)
    if (!p || cache.has(`${p[0]}|${p[1]}`)) continue
    if (!byLang.has(p[0])) byLang.set(p[0], new Set())
    byLang.get(p[0]).add(p[1])
  }
  const total = [...byLang.values()].reduce((n, s) => n + s.size, 0)
  ctx.log(`${total} artículos por resumir`)
  // bloques de 20 títulos, 4 peticiones a la vez (Wikipedia tolera bien este ritmo)
  const jobs = []
  for (const [lang, set] of byLang) {
    const titles = [...set]
    for (let i = 0; i < titles.length; i += 20) jobs.push([lang, titles.slice(i, i + 20)])
  }
  let done = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (jobs.length) {
      const [lang, chunk] = jobs.shift()
      const data = await extracts(lang, chunk)
      if (!data) {
        ctx.log(`⚠ bloque sin respuesta (${lang}); se reintentará en la próxima ejecución`)
        continue
      }
      // de cada título pedido al artículo final (normalizaciones y redirecciones)
      const norm = new Map((data.query?.normalized ?? []).map((r) => [r.from, r.to]))
      const redir = new Map((data.query?.redirects ?? []).map((r) => [r.from, r.to]))
      const text = new Map((data.query?.pages ?? []).map((pg) => [pg.title, pg.extract ?? null]))
      const lines = chunk.map((t) => {
        const n = norm.get(t) ?? t
        const x = text.get(redir.get(n) ?? n) ?? null
        return JSON.stringify({ lang, title: t, x: x ? x.trim().slice(0, MAX) : null })
      })
      appendFileSync(CACHE(), lines.join('\n') + '\n')
      done += chunk.length
      if (done % 2000 < 20) ctx.log(`${done}/${total}`)
      await sleep(100)
    }
  }))
  ctx.log('✓ caché de resúmenes al día')
}

export async function ingest(store, ctx) {
  const cache = readCache()
  if (!cache.size) return ctx.log('sin caché (npm run pipeline -- geo download wikipedia)')
  const set = store.db.prepare('UPDATE entity SET summary = ? WHERE id = ? AND summary IS NULL')
  let n = 0
  for (const r of store.db.prepare('SELECT id, wiki FROM entity WHERE wiki IS NOT NULL AND summary IS NULL').all()) {
    const p = parseWiki(r.wiki)
    const x = p && cache.get(`${p[0]}|${p[1]}`)
    if (!x) continue
    set.run(x.trim(), r.id)
    n++
  }
  ctx.log(`✓ ${n} resúmenes de Wikipedia`)
}
