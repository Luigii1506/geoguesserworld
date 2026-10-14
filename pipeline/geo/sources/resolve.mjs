// RESOLVE Ecoregions 2017 (Dinerstein et al. 2017, BioScience; CC BY 4.0): las
// 846 ecorregiones terrestres del mundo agrupadas en 14 biomas. Crea entidades
// `ecoregion` (con su bioma como etiqueta, su superficie y sus países); el mapa
// de biomas por país es la capa `biome` (pipeline/geo/layers/biomes.mjs).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { download as fetchFile, rawDir } from '../lib/files.mjs'
import { createLlm } from '../../lib/llm.mjs'
import { toGeoJSON } from '../lib/gdal.mjs'
import { WORK } from '../lib/dirs.mjs'
import { areaKm2, bboxOf, eachCoord, labelPoint } from '../lib/geom.mjs'

export const meta = {
  id: 'resolve',
  name: 'RESOLVE Ecoregions 2017',
  url: 'https://ecoregions.appspot.com',
  license: 'CC BY 4.0',
  attribution: 'Dinerstein, E. et al. (2017). An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm. BioScience 67(6): 534–545 (RESOLVE Ecoregions 2017)',
  version: '2017',
}

const URL = 'https://storage.googleapis.com/teow2016/Ecoregions2017.zip'
export const zipPath = () => fetchFile(meta.id, URL)
export const shp = async () => `/vsizip/${await zipPath()}/Ecoregions2017.shp`

// número de bioma → clave, nombre en español y color oficial de RESOLVE
export const BIOMES = [
  [1, 'selva_humeda', 'Selva tropical húmeda', '#38A700'],
  [2, 'selva_seca', 'Selva tropical seca', '#CCCD65'],
  [3, 'conifera_tropical', 'Bosque de coníferas tropical', '#88CE66'],
  [4, 'bosque_templado', 'Bosque templado caducifolio y mixto', '#00734C'],
  [5, 'conifera_templada', 'Bosque templado de coníferas', '#458970'],
  [6, 'taiga', 'Taiga (bosque boreal)', '#7AB6F5'],
  [7, 'sabana', 'Sabana y pastizal tropical', '#FEAA01'],
  [8, 'estepa', 'Pradera y estepa templada', '#FEFF73'],
  [9, 'sabana_inundable', 'Pastizal y sabana inundable', '#BEE7FF'],
  [10, 'paramo', 'Pastizal de montaña (páramo, puna)', '#D6C39D'],
  [11, 'tundra', 'Tundra', '#9ED7C2'],
  [12, 'mediterraneo', 'Bosque y matorral mediterráneo', '#FE0000'],
  [13, 'desierto', 'Desierto y matorral xérico', '#CC6767'],
  [14, 'manglar', 'Manglar', '#FE01C4'],
].map(([value, key, label, color]) => ({ value, key, label, color }))
const BIOME = new Map(BIOMES.map((b) => [b.value, b]))

export async function fetchAll() {
  return toGeoJSON(await shp(), path.join(WORK, 'resolve', 'ecoregions.geojson'), {
    select: 'ECO_ID,ECO_NAME,BIOME_NUM,REALM,COLOR', simplify: 0.01,
  })
}

const NAMES_ES = () => path.join(rawDir('resolve'), 'names_es.json')

/** Descarga y traduce los nombres al español (DeepSeek, con caché; céntimos). */
export async function download(ctx) {
  const geo = await fetchAll()
  const done = existsSync(NAMES_ES()) ? JSON.parse(readFileSync(NAMES_ES(), 'utf8')) : {}
  const todo = geo.features.map((f) => f.properties).filter((p) => p.ECO_NAME && !done[p.ECO_ID])
  if (!todo.length) return ctx.log('nombres en español al día')
  const llm = createLlm({ concurrency: 6 })
  const batches = []
  for (let i = 0; i < todo.length; i += 80) batches.push(todo.slice(i, i + 80))
  await Promise.all(batches.map(async (b) => {
    const answer = await llm.json([
      { role: 'system', content: 'Traduces nombres de ecorregiones (WWF/RESOLVE) al español de forma natural y precisa, como lo haría un atlas en español: "Sierra Madre Occidental pine-oak forests" → "Bosques de pino-encino de la Sierra Madre Occidental". Conserva los nombres propios (en su forma española si existe). Responde solo JSON: {"names": {"<id>": "<nombre>"}}.' },
      { role: 'user', content: JSON.stringify(Object.fromEntries(b.map((p) => [p.ECO_ID, p.ECO_NAME]))) },
    ], { maxTokens: 6000 })
    for (const [id, name] of Object.entries(answer?.names ?? {})) if (typeof name === 'string' && name.trim()) done[id] = name.trim()
  }))
  writeFileSync(NAMES_ES(), JSON.stringify(done, null, 1))
  ctx.log(`✓ ${Object.keys(done).length} nombres en español`)
}

export async function ingest(store, ctx) {
  const geo = await fetchAll(ctx)
  const es = existsSync(NAMES_ES()) ? JSON.parse(readFileSync(NAMES_ES(), 'utf8')) : {}
  let n = 0
  for (const f of geo.features) {
    const p = f.properties
    const biome = BIOME.get(Math.round(p.BIOME_NUM))
    if (!f.geometry || !biome || !p.ECO_NAME) continue
    const lp = labelPoint(f.geometry)
    if (!lp) continue
    // países que toca: los que contienen algún punto de muestra del polígono
    const ccs = new Set()
    let k = 0
    eachCoord(f.geometry, ([x, y]) => {
      if (k++ % 40) return
      const c = ctx.shapes.countryAt(x, y, 0)
      if (c) ccs.add(c.cc)
    })
    const c0 = ctx.shapes.countryAt(lp[0], lp[1], 50)?.cc
    if (c0) ccs.add(c0)
    if (!ccs.size) continue
    const id = store.entity({
      kind: 'ecoregion', name: es[p.ECO_ID] ?? p.ECO_NAME, name_en: p.ECO_NAME, cc: c0 ?? [...ccs][0], ccs: [...ccs],
      lat: lp[1], lng: lp[0], bbox: bboxOf(f.geometry).map((v) => v.toFixed(3)).join(','),
      descr: `${biome.label} · ${p.REALM}`, tags: [biome.key], xref: { eco: p.ECO_ID },
    })
    store.fact(id, 'area', Math.round(areaKm2(f.geometry)), { unit: 'km2', source: meta.id, keep: true })
    store.fact(id, 'biome', biome.label, { source: meta.id })
    for (const cc of ccs) store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    n++
  }
  ctx.log(`✓ ${n} ecorregiones`)
}
