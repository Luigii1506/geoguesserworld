#!/usr/bin/env node
// Pipeline de conocimiento de GeoMastery.
//
//   npm run pipeline                       todo: países → fuentes → deduplicar → exportar → informe
//   npm run pipeline -- countries          solo la base global de países
//   npm run pipeline -- extract plonkit geotips   solo esas fuentes
//   npm run pipeline -- dedup | export | report
//   npm run pipeline -- semantic [--limit N] [--model deepseek-v4-pro]
//                                          paráfrasis con DeepSeek (de pago, con caché)
//   npm run pipeline -- images [fuentes] [--limit N] [--retry] [--slow]   copia propia de las imágenes
//   npm run pipeline -- upload             sube data/images al bucket R2
//   añade --refresh para ignorar la caché en crudo y volver a descargar
//
// Los datos viven en data/ (fuera de git): data/raw/ (crudo) y
// data/geomastery.db (SQLite). Solo uso personal.

import { openDb, now } from './lib/db.mjs'
import { createResolver } from './lib/countries.mjs'
import { createSink } from './lib/sink.mjs'
import { seedCategories } from './lib/taxonomy.mjs'
import { exportAll } from './export.mjs'
import { dedup } from './dedup.mjs'
import { semantic } from './semantic.mjs'
import { review } from './review.mjs'
import { translate } from './translate.mjs'
import { extractAttributes, computeTraitStats } from './attributes.mjs'
import { find } from './find.mjs'
import { verifyTraits } from './verify.mjs'
import { demonyms } from './demonyms.mjs'
import { report } from './report.mjs'
import { images } from './images.mjs'
import { upload } from './upload.mjs'
import { duels } from './duels.mjs'
import { atlas } from './atlas.mjs'
import { places, geocode, placesEs, placeInfo, placeFame } from './places.mjs'
import * as countriesBase from './sources/countries-base.mjs'
import * as plonkit from './sources/plonkit.mjs'
import * as geotips from './sources/geotips.mjs'
import * as geometas from './sources/geometas.mjs'
import * as geohints from './sources/geohints.mjs'
import * as openguessr from './sources/openguessr.mjs'
import * as learnablemeta from './sources/learnablemeta.mjs'

const SOURCES = [plonkit, geotips, geometas, geohints, openguessr, learnablemeta]

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
// posiciones de los valores de --limit y --model, para no tomarlos como etapa o fuente
const flagValueAt = new Set(
  ['--limit', '--model', '--countries', '--categories'].map((f) => args.indexOf(f)).filter((i) => i >= 0).map((i) => i + 1),
)
const positional = args.filter((a, i) => !a.startsWith('--') && !flagValueAt.has(i))
const stage = positional[0] ?? 'all'
const only = positional.slice(1)

const db = openDb()
seedCategories(db)

function registerSource(m) {
  db.prepare(
    `INSERT INTO sources (id, name, homepage, license, method) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, homepage=excluded.homepage,
       license=excluded.license, method=excluded.method`,
  ).run(m.id, m.name, m.homepage, m.license, m.method)
}

function makeCtx(sourceId) {
  const prefix = `[${sourceId}]`
  return {
    db,
    sourceId,
    refresh,
    log: (...a) => console.log(prefix, ...a),
    warn: (...a) => console.warn(prefix, '⚠', ...a),
  }
}

async function runCountries() {
  registerSource(countriesBase.meta)
  const ctx = makeCtx('countries')
  const r = await countriesBase.run(ctx)
  ctx.log(`✓ ${r.countries} países (${r.withPopulation} con población de Wikidata)`)
}

async function runExtract() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM countries').get().n
  if (count === 0) await runCountries()
  const resolver = createResolver(db)

  const targets = only.length ? SOURCES.filter((s) => only.includes(s.meta.id)) : SOURCES
  for (const src of targets) {
    registerSource(src.meta)
    const runId = `${src.meta.id}-${Date.now()}`
    const ctx = { ...makeCtx(src.meta.id), resolver, runId }
    db.prepare('INSERT INTO runs (id, source_id, started_at) VALUES (?, ?, ?)').run(runId, src.meta.id, now())
    const t0 = Date.now()
    const sink = createSink(ctx)
    try {
      db.exec('BEGIN')
      const result = await src.run(ctx, sink)
      const stats = sink.finish()
      db.exec('COMMIT')
      db.prepare('UPDATE runs SET finished_at=?, hints=?, removed=?, ok=1 WHERE id=?').run(
        now(), stats.added, stats.removed, runId,
      )
      ctx.log(
        `✓ ${stats.added} pistas · ${stats.images} imágenes · ${stats.attributes} atributos · ` +
          `${stats.removed} eliminadas · ${((Date.now() - t0) / 1000).toFixed(0)}s`,
        JSON.stringify(result),
      )
    } catch (e) {
      db.exec('ROLLBACK')
      db.prepare('UPDATE runs SET finished_at=?, ok=0 WHERE id=?').run(now(), runId)
      ctx.warn(`falló: ${e.stack ?? e.message}`)
    }
  }

  if (resolver.unresolved.size) {
    const list = [...resolver.unresolved.entries()].sort((a, b) => b[1] - a[1])
    console.log(`\nNombres de país sin resolver (${list.length}) — añade alias en pipeline/lib/countries.mjs:`)
    console.log(list.slice(0, 40).map(([n, c]) => `  ${n} (${c})`).join('\n'))
  }
}

const stages = {
  countries: runCountries,
  extract: runExtract,
  dedup: () => dedup(db),
  // de pago (DeepSeek), con caché: no forma parte de "all"
  semantic: () => semantic(db, { model: flag('model'), limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  review: () => review(db, { model: flag('model'), limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  translate: () => translate(db, { model: flag('model'), limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  // --countries hu,hr,it  --categories bollards,road_lines  (para pruebas)
  attributes: () =>
    extractAttributes(db, {
      model: flag('model'),
      countries: flag('countries')?.split(','),
      categories: flag('categories')?.split(','),
    }),
  traits: () => computeTraitStats(db),
  find: () => find(db, positional.slice(1)),
  verify: () => verifyTraits(db, { model: flag('model') }),
  demonyms: () => demonyms(db, { model: flag('model') }),
  // copia propia de las imágenes (WebP) y subida al bucket R2 privado
  images: () =>
    images(db, {
      limit: flag('limit') ? Number(flag('limit')) : Infinity,
      retry: args.includes('--retry'),
      slow: args.includes('--slow'),
      sources: positional.slice(1),
    }),
  upload: () => upload(db, { limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  // duelos entre gemelos con DeepSeek (de pago, con caché); luego `export`
  duels: () => duels(db, { model: flag('model'), limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  // lugares mencionados en las pistas (DeepSeek) y sus coordenadas (Natural Earth + OpenStreetMap)
  places: () => places(db, { model: flag('model'), limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  'places-es': () => placesEs(db, { model: flag('model') }),
  'place-fame': () => placeFame(db),
  'place-info': () => placeInfo(db, { limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  geocode: () => geocode(db, { limit: flag('limit') ? Number(flag('limit')) : Infinity }),
  // atlas: los lugares más importantes de cada país (Wikidata + Wikipedia, gratis)
  atlas: () => atlas(db, { only: positional.slice(1).length ? positional.slice(1) : undefined }),
  export: () => exportAll(db),
  report: () => report(db),
  all: async () => {
    await runCountries()
    await runExtract()
    dedup(db)
    exportAll(db)
    report(db)
  },
}

if (!stages[stage]) {
  console.error(`Etapa desconocida "${stage}". Usa: ${Object.keys(stages).join(' | ')}`)
  process.exit(1)
}
await stages[stage]()
