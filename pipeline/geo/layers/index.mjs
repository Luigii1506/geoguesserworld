// Capas de terreno: repartos por país y región (facts) e imagen por país (assets).
//
//   npm run pipeline -- geo layers                    todas las capas, todos los países
//   npm run pipeline -- geo layers relief landform    solo esas capas
//   npm run pipeline -- geo layers relief --countries mx,ad   solo esos países
//   añade --no-render o --no-stats para saltar una parte
//
// Una capa = { id, family, name, kind, ord, source, legend, prepare(), stats?(), render?(frame) }.
// stats() → { scope, values: Map(zona → Map(clase → valor)) }, zonas "iso:<cc>" y "ne:<adm1_code>".
// Lo calculado se guarda en data/geo-work/stats/<capa>.json y data/geo-assets/manifest.json:
// `geo build` lo vuelve a aplicar (fuente "atlas"), sin recalcular.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ASSETS, WORK } from '../lib/dirs.mjs'
import { openStore, storeExists } from '../store.mjs'
import { shapes } from '../sources/naturalearth.mjs'
import { countryFrame } from './render.mjs'
import * as vector from './vector.mjs'
import * as relief from './relief.mjs'
import * as landcover from './landcover.mjs'
import * as climate from './climate.mjs'
import * as crops from './crops.mjs'
import * as biomes from './biomes.mjs'

export const LAYERS = [...vector.layers, ...relief.layers, ...landcover.layers, ...climate.layers, ...crops.layers, ...biomes.layers]

const STATS_DIR = path.join(WORK, 'stats')
const MANIFEST = path.join(ASSETS, 'manifest.json')

const readJson = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d)

async function pool(items, n, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift())
  }))
}

export async function runLayers(args, ctx) {
  const flag = (name) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--countries')
  const layers = LAYERS.filter((l) => !ids.length || ids.includes(l.id))
  if (!layers.length) throw new Error(`capas: ${LAYERS.map((l) => l.id).join(', ')}`)
  const s = await shapes()
  const only = flag('countries')?.split(',')
  const ccs = s.countries.map((c) => c.cc).filter((cc) => !only || only.includes(cc))
  const manifest = readJson(MANIFEST, {})
  mkdirSync(STATS_DIR, { recursive: true })
  mkdirSync(ASSETS, { recursive: true })

  for (const layer of layers) {
    const log = (...a) => console.log(`[${layer.id}]`, ...a)
    const t0 = Date.now()
    await layer.prepare?.(ctx)
    if (layer.stats && !args.includes('--no-stats')) {
      // una capa puede dar varios conjuntos (toneladas y hectáreas…), cada uno con su ámbito
      const result = await layer.stats(ctx)
      const sets = (Array.isArray(result) ? result : [result]).map(({ scope, values }) => ({
        scope, values: Object.fromEntries([...values].map(([zone, m]) => [zone, Object.fromEntries(m)])),
      }))
      writeFileSync(path.join(STATS_DIR, `${layer.id}.json`), JSON.stringify({ sets }))
      log(`repartos de ${Object.keys(sets[0]?.values ?? {}).length} países y regiones`)
    }
    if (layer.render && !args.includes('--no-render')) {
      let done = 0
      let failed = 0
      await pool(ccs, layer.concurrency ?? 3, async (cc) => {
        const frame = await countryFrame(cc)
        if (!frame) return
        try {
          const asset = await layer.render(frame, ctx)
          if (asset) manifest[`${layer.id}/${cc}`] = asset
        } catch (e) {
          failed++
          console.warn(`[${layer.id}] ⚠ ${cc}: ${e.message}`)
        }
        if (++done % 25 === 0) {
          log(`${done}/${ccs.length} países`)
          writeFileSync(MANIFEST, JSON.stringify(manifest))
        }
      })
      writeFileSync(MANIFEST, JSON.stringify(manifest))
      log(`imágenes de ${done - failed} países${failed ? ` · ${failed} fallidos` : ''}`)
    }
    log(`✓ en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }

  // aplicar a la base actual sin reconstruirla
  if (storeExists()) {
    const store = openStore()
    store.db.exec('BEGIN')
    applyLayers(store, { log: (...a) => console.log('[atlas]', ...a) })
    store.db.exec('COMMIT')
    store.close()
  }
}

/** Fuente "atlas" de `geo build`: capas, repartos y archivos por país ya calculados. */
export const meta = {
  id: 'atlas',
  name: 'Capas de terreno de GeoMastery',
  url: null,
  license: 'Derivado de las fuentes de cada capa',
  attribution: 'Elaboración propia a partir de ETOPO, ESA WorldCover, RESOLVE, Köppen-Geiger (Beck et al.) y MapSPAM',
}

export function applyLayers(store, ctx) {
  const manifest = readJson(MANIFEST, {})
  store.db.exec('DELETE FROM layer; DELETE FROM asset')
  const insLayer = store.db.prepare('INSERT INTO layer (id, family, name, kind, legend, source_id, ord) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insAsset = store.db.prepare('INSERT OR REPLACE INTO asset (layer_id, cc, path, bbox, width, height, bytes, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  // los repartos anteriores de estas capas se reemplazan
  const delFacts = store.db.prepare('DELETE FROM fact WHERE key LIKE ? AND source_id = ?')
  let facts = 0
  for (const l of LAYERS) {
    store.source(l.source)
    insLayer.run(l.id, l.family, l.name, l.kind, JSON.stringify(l.legend), l.source.id, l.ord ?? 0)
    const file = path.join(STATS_DIR, `${l.id}.json`)
    if (!existsSync(file)) continue
    delFacts.run(`${l.id}:%`, l.source.id)
    for (const { scope, values } of JSON.parse(readFileSync(file, 'utf8')).sets) {
      for (const [zone, m] of Object.entries(values)) {
        const [scheme, code] = zone.split(':')
        const id = store.resolve(scheme === 'iso' ? 'iso' : 'ne', code)
        if (!id) continue
        for (const [cls, v] of Object.entries(m)) {
          store.fact(id, `${l.id}:${cls}`, v, { scope, source: l.source.id })
          facts++
        }
      }
    }
  }
  let assets = 0
  for (const a of Object.values(manifest)) {
    if (!LAYERS.some((l) => l.id === a.layer_id)) continue
    insAsset.run(a.layer_id, a.cc, a.path, a.bbox, a.width, a.height, a.bytes, a.hash)
    assets++
  }
  ctx.log(`✓ ${LAYERS.length} capas · ${facts} repartos · ${assets} imágenes por país`)
}

export async function ingest(store, ctx) {
  applyLayers(store, ctx)
}
