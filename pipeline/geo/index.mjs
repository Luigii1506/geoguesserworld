// Etapas de la base geográfica (ver docs/geo.md).
//
//   npm run pipeline -- geo download [fuente…]   descarga las fuentes
//   npm run pipeline -- geo build                reconstruye data/geo.db
//   npm run pipeline -- geo layers [capa…]       capas de terreno por país y repartos
//   npm run pipeline -- geo publish              D1 + R2
//
// Una fuente = { meta, download?(ctx), ingest(store, ctx) }. El orden de
// SOURCES es la prioridad: lo que escribe una fuente antes no lo pisa otra.

import { openStore } from './store.mjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from '../lib/paths.mjs'

const SCHEMA_FILE = path.join(ROOT, 'geo', 'schema.sql')
import { derive } from './derive.mjs'
import * as naturalearth from './sources/naturalearth.mjs'
import * as wikidata from './sources/wikidata.mjs'
import * as gvp from './sources/gvp.mjs'
import * as hints from './sources/hints.mjs'
import * as geonames from './sources/geonames.mjs'
import * as ghsl from './sources/ghsl.mjs'
import * as gmba from './sources/gmba.mjs'
import * as hydrolakes from './sources/hydrolakes.mjs'
import * as wikidataEnrich from './sources/wikidata-enrich.mjs'
import * as wikipedia from './sources/wikipedia.mjs'
import * as resolve from './sources/resolve.mjs'
import * as atlas from './layers/index.mjs'
import * as guides from './sources/guides.mjs'
import { publish } from './publish.mjs'
import { meta as countriesMeta } from '../sources/countries-base.mjs'

// orden = prioridad y dependencias: GHSL busca la ciudad principal entre las de GeoNames,
// GMBA sitúa las cumbres ya cargadas, y el enriquecimiento de Wikidata va al final
export const SOURCES = [naturalearth, wikidata, gvp, hints, geonames, ghsl, gmba, hydrolakes, resolve, wikidataEnrich, wikipedia, atlas, guides]

function context(staging, opts = {}) {
  return {
    staging,
    refresh: !!opts.refresh,
    log: (...a) => console.log('[geo]', ...a),
    warn: (...a) => console.warn('[geo] ⚠', ...a),
  }
}

async function runDownload(ctx, only) {
  for (const s of SOURCES.filter((x) => !only.length || only.includes(x.meta.id))) {
    if (!s.download) continue
    await s.download({ ...ctx, log: (...a) => console.log(`[${s.meta.id}]`, ...a) })
  }
}

async function runBuild(ctx) {
  const t0 = Date.now()
  const store = openStore({ fresh: true })
  ctx.shapes = await naturalearth.shapes()
  store.source({ id: countriesMeta.id, name: countriesMeta.name, url: countriesMeta.homepage, license: countriesMeta.license, attribution: 'mledoze/countries (ODbL) y Wikidata' })
  for (const s of SOURCES) {
    store.source({ ...s.meta, retrieved: new Date().toISOString().slice(0, 10) })
    const log = (...a) => console.log(`[${s.meta.id}]`, ...a)
    store.db.exec('BEGIN')
    try {
      await s.ingest(store, { ...ctx, log })
      store.db.exec('COMMIT')
    } catch (e) {
      store.db.exec('ROLLBACK')
      throw e
    }
  }
  await derive(store, ctx)
  store.meta('built_at', new Date().toISOString())
  const counts = store.db.prepare('SELECT kind, COUNT(*) n FROM entity GROUP BY kind ORDER BY n DESC').all()
  const file = store.finish()
  ctx.log(`✓ ${file} en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  ctx.log(counts.map((c) => `${c.kind} ${c.n}`).join(' · '))
}

/** @param {string[]} args  argumentos tras "geo" (etapa, nombres y opciones --x) */
export async function geo(staging, args, opts) {
  const [step = 'build', ...rest] = args
  const only = rest.filter((a) => !a.startsWith('--'))
  const ctx = context(staging, opts)
  if (step === 'download') return runDownload(ctx, only)
  if (step === 'build') return runBuild(ctx)
  if (step === 'layers') return atlas.runLayers(rest, ctx)
  if (step === 'publish') return publish(rest)
  // guías: aplicar a la base actual sin reconstruirla (tras `export`)
  if (step === 'guides') {
    const store = openStore()
    store.db.exec(readFileSync(SCHEMA_FILE, 'utf8'))
    store.db.exec('BEGIN')
    await guides.ingest(store, { ...ctx, log: (...a) => console.log('[guides]', ...a) })
    store.db.exec('COMMIT')
    store.db.exec('ANALYZE')
    return store.close()
  }
  throw new Error(`geo: etapa desconocida "${step}" (download | build | layers | publish)`)
}
