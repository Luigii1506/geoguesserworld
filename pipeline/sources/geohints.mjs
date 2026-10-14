// GeoHints — diccionario visual por categoría. Sus páginas /meta/* usan
// varios formatos y el adaptador prueba cada uno:
//   1. tarjetas: país + foto + enlace a Maps                → pistas
//   2. tarjetas agrupadas bajo un encabezado de país        → pistas
//   3. mapas coloreados initSimpleMapChart({data:{país:valor}}) → atributos
//   4. tarjetas de años de cobertura (país → años)          → atributos
//   5. sufijos de calle (país → idioma → sufijo = traducción)  → atributos + pista
//   6. grupos de países bajo <div id="X"> (líneas viales)   → atributos

import { fetchText } from '../lib/fetch.mjs'
import { htmlToText, latLngFromMapsUrl } from '../lib/html.mjs'

export const meta = {
  id: 'geohints',
  name: 'GeoHints',
  homepage: 'https://geohints.com/',
  license: 'Sin licencia explícita: todos los derechos reservados. Uso personal.',
  method: 'HTML de /meta/* (tarjetas, mapas de datos y listas)',
}

const BASE = 'https://geohints.com'
// ya cubiertas por la base global de países (datos abiertos)
const SKIP = new Set(['countries', 'currencies', 'domains', 'phoneNumbers', 'drivingSide', 'honey', 'flags'])

const COMPANY_PAGES = {
  'companies/beer': { sub: 'beer', prefix: 'Beer brand' },
  'companies/gasStations': { sub: 'gas_station', prefix: 'Gas station' },
  'companies/post': { sub: 'post', prefix: 'Postal service' },
}

const MAPS_LINK = /href="(https:\/\/(?:goo\.gl|maps\.app\.goo\.gl|www\.google\.[a-z.]+)\/[^"]*)"/

/**
 * Imágenes de un trozo de tarjeta. Una tarjeta puede tener varias (México en
 * cervezas: Corona, Victoria…), cada una con su nombre en negrita, una nota
 * opcional ("Old") y su enlace a Maps: se leen todas, no solo la primera.
 */
function imagesIn(chunk) {
  const out = []
  const parts = chunk.split(/(?=<img\b)/).slice(1)
  for (const part of parts) {
    const image = part.match(/^<img[^>]*src="(https:\/\/[^"]+)"/)?.[1]
    if (!image || /\/logos\//.test(image)) continue
    out.push({
      image,
      link: part.match(MAPS_LINK)?.[1] ?? null,
      name: part.match(/<div class="text-center font-bold">\s*([^<]+?)\s*<\/div>/)?.[1] ?? null,
      note: part.match(/<div class="text-center font-thin">\s*([^<]+?)\s*<\/div>/)?.[1] ?? null,
    })
  }
  return out
}

function parseCards(html) {
  const items = []
  for (const chunk of html.split('<div class="text-white text-md p-2').slice(1)) {
    const country = chunk.match(/<span class="font-bold">\s*([^<]+?)\s*<\/span>/)?.[1]
    if (!country) continue
    for (const img of imagesIn(chunk)) items.push({ country, ...img })
  }
  return items
}

function parseGroupedCards(html) {
  const items = []
  const parts = html.split(/<span class="font-bold text-xl[^"]*">\s*([^<]+?)\s*<\/span>/)
  for (let i = 1; i < parts.length; i += 2) {
    for (const img of imagesIn(parts[i + 1])) items.push({ country: parts[i], ...img })
  }
  return items
}

/** initSimpleMapChart(document.getElementById("X"), { ... data: {...} }) */
function parseMapCharts(html) {
  const out = []
  const re = /initSimpleMapChart\(\s*document\.getElementById\("([^"]+)"\)\s*,\s*\{[\s\S]*?data:\s*(\{[\s\S]*?\})\s*[,}]/g
  for (const m of html.matchAll(re)) {
    // mapas resumen ("allGens") repiten en un solo texto lo que dan los individuales
    if (/^all/i.test(m[1])) continue
    try {
      const data = JSON.parse(m[2].replace(/,\s*}$/, '}'))
      for (const [country, value] of Object.entries(data)) out.push({ group: m[1], country, value: String(value) })
    } catch {
      /* bloque no-JSON: se ignora */
    }
  }
  return out
}

/** Tarjetas <h2>País</h2> + celdas con valores (p. ej. años de cobertura). */
function parseValueCards(html) {
  const out = []
  const cards = html.split(/<div class="bg-gray-800 p-4 border-white-400 border-2">/).slice(1)
  for (const card of cards) {
    const country = card.match(/<h2[^>]*>\s*([^<]+?)\s*<\/h2>/)?.[1]
    if (!country) continue
    for (const v of card.matchAll(/<div class="border-2 border-white p-2\s*">\s*([^<]+?)\s*<\/div>/g)) {
      if (v[1] !== 'nothing') out.push({ country, value: v[1] })
    }
  }
  return out
}

function parseSuffixes(html) {
  const out = []
  const boxes = html.split(/<div class="grid items-start h-full bg-gray-800[^"]*">/).slice(1)
  for (const box of boxes) {
    const country = box.match(/^\s*<div>\s*([^<]+?)\s*<\/div>/)?.[1]
    if (!country) continue
    let language = null
    const re = /<div class="font-thin">\s*([^<]+?)\s*<\/div>|<div class="w-full">([\s\S]*?)<\/div>\s*<div class="w-full font-thin">([\s\S]*?)<\/div>/g
    for (const m of box.matchAll(re)) {
      if (m[1]) language = m[1]
      else out.push({ country, language, suffix: htmlToText(m[2]), meaning: htmlToText(m[3]) })
    }
  }
  return out
}

function parseGroups(html) {
  const groups = []
  const parts = html.split(/<div id="([A-Za-z]+)"><\/div>/)
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i - 1].match(/>([^<>{}]{4,90})<\/[a-z0-9]+>\s*$/)?.[1]?.trim() ?? parts[i]
    const countries = [...(parts[i + 1] ?? '').matchAll(/border-white m-2 p-2">([^<]+?)\s*<\/span>/g)].map((m) => m[1].trim())
    if (countries.length) groups.push({ id: parts[i], label, countries })
  }
  return groups
}

const LINE_LABELS = {
  yellowWhite: 'Outside: Yellow | Inside: White',
  whiteWhite: 'Outside: White | Inside: White',
  whiteYellow: 'Outside: White | Inside: Yellow',
  yellowYellow: 'Outside: Yellow | Inside: Yellow',
  whiteWhiteYellow: 'Outside: White | Inside: White and yellow',
}

export async function run(ctx, sink) {
  const seed = await fetchText(ctx, `${BASE}/meta/bollards`, { minIntervalMs: 1500 })
  const pages = [...new Set([...seed.matchAll(/href="\/meta\/([a-zA-Z/]+)"/g)].map((m) => m[1]))].filter(
    (p) => !SKIP.has(p),
  )
  ctx.log(`${pages.length} páginas /meta descubiertas`)

  const summary = {}
  for (const page of pages) {
    const url = `${BASE}/meta/${page}`
    let html
    try {
      html = await fetchText(ctx, url, { minIntervalMs: 1500 })
    } catch (e) {
      ctx.warn(`${page}: ${e.message}`)
      continue
    }
    const label = page // p. ej. "signs/stop", "utilityPoles": la taxonomía lo traduce

    let cards = parseCards(html)
    if (!cards.length) cards = parseGroupedCards(html)
    if (cards.length) {
      const company = COMPANY_PAGES[page]
      cards.forEach((c, i) => {
        const ll = latLngFromMapsUrl(c.link)
        // en las páginas de comercios cada imagen es una marca con nombre: se guarda como texto
        const name = c.name ? `${c.name}${c.note ? ` (${c.note})` : ''}` : null
        sink.add({
          key: `${page}:${c.image}`,
          url,
          country: c.country,
          label,
          category: company ? { category: 'culture', subcategory: company.sub } : undefined,
          title: name,
          text: company && name ? `${company.prefix}: ${name}` : name,
          images: [c.image],
          locationUrl: c.link,
          lat: ll?.lat,
          lng: ll?.lng,
          extra: { page, ord: i, name: c.name, note: c.note },
        })
      })
      summary[page] = `${cards.length} fotos`
      continue
    }

    const charts = parseMapCharts(html)
    if (charts.length) {
      for (const c of charts) sink.attribute({ attribute: page, country: c.country, value: c.value, detail: { group: c.group }, url })
      summary[page] = `${charts.length} datos (mapa)`
      continue
    }

    if (page === 'streetSuffix') {
      const rows = parseSuffixes(html)
      const byCountry = new Map()
      for (const r of rows) {
        sink.attribute({ attribute: 'streetSuffix', country: r.country, value: r.suffix, detail: { language: r.language, meaning: r.meaning }, url })
        if (!byCountry.has(r.country)) byCountry.set(r.country, [])
        byCountry.get(r.country).push(r)
      }
      for (const [country, list] of byCountry) {
        sink.add({
          key: `streetSuffix:${country}`,
          url,
          country,
          label: 'streetSuffix',
          title: 'Street suffixes',
          text: list.map((r) => `${r.suffix} = ${r.meaning}${r.language ? ` (${r.language})` : ''}`).join('\n'),
        })
      }
      summary[page] = `${rows.length} sufijos en ${byCountry.size} países`
      continue
    }

    const values = parseValueCards(html)
    if (values.length) {
      for (const v of values) sink.attribute({ attribute: page, country: v.country, value: v.value, url })
      summary[page] = `${values.length} datos (tarjetas)`
      continue
    }

    const groups = parseGroups(html)
    if (groups.length) {
      for (const g of groups)
        for (const country of g.countries)
          sink.attribute({ attribute: page, country, value: LINE_LABELS[g.id] ?? g.label, detail: { group: g.id }, url })
      summary[page] = `${groups.length} grupos`
      continue
    }

    summary[page] = 'sin formato reconocido'
    ctx.warn(`${page}: formato no reconocido`)
  }
  return summary
}
