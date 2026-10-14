#!/usr/bin/env node
// Importador de GeoHints — SOLO USO PERSONAL.
// Parsea las páginas públicas /meta/* (país + imagen + enlace a Maps) y guarda
// public/community/geohints/<categoria>.json. Las imágenes se cargan en
// caliente desde su CDN; no redistribuir.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'public', 'community', 'geohints')

const CATEGORIES = [
  'architecture', 'bollards', 'cameraGens', 'companies/beer', 'companies/gasStations',
  'companies/post', 'currencies', 'domains', 'drivingSide', 'flags', 'followCars',
  'googleVehicles/animals', 'googleVehicles/boats', 'googleVehicles/cars',
  'googleVehicles/motorcycles', 'googleVehicles/snowmobiles', 'googleVehicles/trains',
  'houseNumbers', 'licensePlates', 'lines', 'nature', 'phoneNumbers', 'postBoxes',
  'rifts', 'sceneries', 'sidewalks', 'signs/animalWarning', 'signs/backOfSigns',
  'signs/busStop', 'signs/chevrons', 'signs/citySigns', 'signs/directions',
  'signs/pedestrian', 'signs/railwayCrossing', 'signs/roadNumbering', 'signs/signPosts',
  'signs/speed', 'signs/stop', 'signs/streetNames', 'signs/tramStop', 'signs/yield',
  'snow', 'streetSuffix', 'trafficLights', 'utilityPoles', 'years',
]

// UA de navegador: algunas páginas devuelven una variante sin contenido a
// clientes no-navegador. Uso personal, con rate-limit amistoso.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCards(html) {
  const items = []
  const chunks = html.split('<div class="text-white text-md p-2')
  for (const chunk of chunks.slice(1)) {
    const country = chunk.match(/<span class="font-bold">\s*([^<]+?)\s*<\/span>/)?.[1]
    const image = chunk.match(/<img[^>]*src="(https:\/\/[^"]+)"/)?.[1]
    const link = chunk.match(/<a href="(https:\/\/(?:goo\.gl|maps\.app\.goo\.gl|www\.google\.[^"]+)[^"]*)"/)?.[1] ?? null
    if (country && image) items.push({ country, image, link })
  }
  return items
}

// Variante con encabezado de país (p. ej. /meta/signs/*): un
// <span class="font-bold text-xl ...">País</span> seguido de varias tarjetas.
function parseGroupedCards(html) {
  const items = []
  const parts = html.split(/<span class="font-bold text-xl[^"]*">\s*([^<]+?)\s*<\/span>/)
  for (let i = 1; i < parts.length; i += 2) {
    const country = parts[i]
    for (const chunk of parts[i + 1].split('text-white text-md p-2').slice(1)) {
      const image = chunk.match(/<img[^>]*src="(https:\/\/[^"]+)"/)?.[1]
      const link = chunk.match(/<a[^>]*href="(https:\/\/(?:goo\.gl|maps\.app\.goo\.gl|www\.google\.[^"]+)[^"]*)"/)?.[1] ?? null
      if (image) items.push({ country, image, link })
    }
  }
  return items
}

// Páginas "agrupadas" (p. ej. /meta/lines): secciones <div id="X"></div>
// seguidas de chips de países. Devuelve grupos con su lista de países.
function parseGroups(html) {
  const parts = html.split(/<div id="([A-Za-z]+)"><\/div>/)
  const groups = []
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i]
    const body = parts[i + 1] ?? ''
    const label = parts[i - 1].match(/>([^<>{}]{4,90})<\/[a-z]+>\s*$/)?.[1]?.trim() ?? null
    const countries = [...body.matchAll(/border-white m-2 p-2">([^<]+?)\s*<\/span>/g)].map((m) => m[1].trim())
    if (countries.length) groups.push({ id, label, countries })
  }
  return groups
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const cats = only.length ? CATEGORIES.filter((c) => only.includes(c)) : CATEGORIES

await mkdir(OUT, { recursive: true })
let ok = 0, fail = 0
for (const cat of cats) {
  try {
    let res
    for (let i = 0; i < 3; i++) {
      res = await fetch(`https://geohints.com/meta/${cat}`, { headers: { 'user-agent': UA } })
      if (res.status !== 429) break
      await sleep(8000 * (i + 1))
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    let items = parseCards(html)
    if (items.length === 0) items = parseGroupedCards(html)
    const groups = items.length === 0 ? parseGroups(html) : []
    if (items.length === 0 && groups.length === 0) throw new Error('0 elementos (¿estructura cambiada?)')
    const out = {
      source: 'GeoHints',
      sourceUrl: `https://geohints.com/meta/${cat}`,
      license: 'Todos los derechos reservados. Importado para uso personal; no redistribuir.',
      importedAt: new Date().toISOString().slice(0, 10),
      category: cat,
      kind: items.length ? 'cards' : 'groups',
      ...(items.length ? { items } : { groups }),
    }
    await writeFile(path.join(OUT, `${cat.replace('/', '_')}.json`), JSON.stringify(out))
    ok++
    console.log(`✓ ${cat}: ${items.length || groups.length} ${items.length ? 'elementos' : 'grupos'}`)
  } catch (e) {
    fail++
    console.warn(`✗ ${cat}: ${e.message}`)
  }
  await sleep(1500)
}
console.log(`\nGeoHints: ${ok} categorías, ${fail} fallos → ${OUT}`)
