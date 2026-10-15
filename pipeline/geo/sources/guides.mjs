// Guías de GeoGuessr en la base de lectura: las fotos del explorador visual y
// las preguntas de Entrenar, para que la app las pida a trozos por la API en
// lugar de descargar visual-index.json (13 MB) y quiz.json (8 MB) enteros.
// Lee lo que escribe `npm run pipeline -- export` en public/community.
//
//   npm run pipeline -- geo guides    aplica a data/geo.db sin reconstruirla

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from '../../lib/paths.mjs'

export const meta = {
  id: 'guides',
  name: 'Guías de la comunidad de GeoGuessr',
  url: null,
  license: 'Con permiso de cada fuente',
  attribution: 'Plonk It, GeoHints, Geometas, GeoTips, Learnable Meta y OpenGuessr',
}

const COMMUNITY = path.join(ROOT, 'public', 'community')
const read = (f) => {
  const file = path.join(COMMUNITY, f)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

export async function ingest(store, ctx) {
  const db = store.db
  const visual = read('visual-index.json')
  const quiz = read('quiz.json')
  if (!visual || !quiz) return ctx.log('falta public/community (npm run pipeline -- export)')
  db.exec('DELETE FROM gg_photo; DELETE FROM gg_quiz')
  const name = new Map(db.prepare('SELECT cc, name FROM country').all().map((r) => [r.cc, r.name]))
  const photo = db.prepare('INSERT INTO gg_photo (id, cc, place, src, k, sk, text, img, link, sort_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  visual.items.forEach((it, i) => {
    photo.run(i + 1, it.c ?? null, it.n ?? null, it.s, it.k, it.sk ?? null, it.t ?? null, it.i, it.l ?? null, (it.c ? name.get(it.c) : null) ?? it.n ?? '—')
  })
  const q = db.prepare('INSERT OR REPLACE INTO gg_quiz (key, kind, cc, k, sk, u, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
  for (const t of quiz.texts) q.run(`t:${t.id}`, 'text', t.c, t.k, t.sk ?? null, t.u ?? null, JSON.stringify(t))
  for (const p of quiz.photos) q.run(`p:${p.id}:${p.i}`, 'photo', p.c, p.k, p.sk ?? null, null, JSON.stringify(p))
  store.meta('guides_categories', visual.categories)
  ctx.log(`✓ ${visual.items.length} fotos del explorador · ${quiz.texts.length + quiz.photos.length} preguntas`)
}
