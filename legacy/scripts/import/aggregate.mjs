#!/usr/bin/env node
// Agrega lo importado (Plonk It + Geometas) en un índice único por categoría
// para la vista comparativa estilo GeoHints: public/community/visual-index.json
// Se ejecuta tras los importadores; es local y de uso personal como el resto.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = path.join(ROOT, 'public', 'community')

// tag de Plonk It / categoría de Geometas → cubo común
const BUCKETS = [
  ['postes', ['pole', 'Poles', 'Sign Posts']],
  ['bolardos', ['bollard', 'Bollards']],
  ['senales', ['chevron/sign', 'Street Sign', 'Chevrons']],
  ['guardarrail', ['guardrail', 'Guardrails']],
  ['lineas', ['roadline', 'Street Markings']],
  ['matriculas', ['license plates', 'License Plate']],
  ['idioma', ['language', 'Language']],
  ['paisaje', ['landscape', 'vegetation', 'Flora']],
  ['arquitectura', ['architecture', 'Buildings']],
  ['coche', ['Google Car', 'Cars']],
  ['cobertura', ['coverage', 'moving info', 'Coverage']],
  ['toponimia', ['Street Name']],
  ['hitos', ['Milestone Markers']],
  ['circulacion', ['Driving Direction']],
]
const toBucket = new Map()
for (const [bucket, keys] of BUCKETS) for (const k of keys) toBucket.set(k, bucket)

const clamp = (s, n = 300) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

const items = []

for (const file of await readdir(path.join(DIR, 'plonkit')).catch(() => [])) {
  if (!file.endsWith('.json')) continue
  const code = file.slice(0, -5)
  const d = JSON.parse(await readFile(path.join(DIR, 'plonkit', file), 'utf8'))
  for (const section of d.sections) {
    for (const tip of section.tips) {
      const bucket = tip.tags.map((t) => toBucket.get(t)).find(Boolean)
      if (!bucket || !tip.image) continue
      items.push({
        c: code,
        s: 'p',
        k: bucket,
        t: clamp(tip.text.replace(/\*\*/g, '')),
        // ruta relativa → proxy local /pi-img (añade el Referer que exige plonkit.net)
        i: tip.image.startsWith('http') ? tip.image : `/pi-img${tip.image}`,
        l: tip.imageLink ?? d.sourceUrl,
      })
    }
  }
}

for (const file of await readdir(path.join(DIR, 'geometas')).catch(() => [])) {
  if (!file.endsWith('.json')) continue
  const code = file.slice(0, -5)
  const d = JSON.parse(await readFile(path.join(DIR, 'geometas', file), 'utf8'))
  for (const m of d.metas) {
    const bucket = toBucket.get(m.category) ?? 'otros'
    if (!m.image) continue
    items.push({ c: code, s: 'g', k: bucket, t: clamp(m.answer), i: m.image, l: m.svUrl ?? d.sourceUrl })
  }
}

// GeoHints: categoría del archivo → cubo; país por nombre inglés → código ISO
const GH_BUCKET = {
  architecture: 'arquitectura', bollards: 'bolardos', cameraGens: 'coche',
  'companies_beer': 'cultura', 'companies_gasStations': 'cultura', 'companies_post': 'cultura',
  currencies: 'cultura', domains: 'idioma', drivingSide: 'circulacion', flags: 'cultura',
  followCars: 'coche', 'googleVehicles_animals': 'coche', 'googleVehicles_boats': 'coche',
  'googleVehicles_cars': 'coche', 'googleVehicles_motorcycles': 'coche',
  'googleVehicles_snowmobiles': 'coche', 'googleVehicles_trains': 'coche',
  houseNumbers: 'mobiliario', licensePlates: 'matriculas', lines: 'lineas',
  nature: 'paisaje', phoneNumbers: 'cultura', postBoxes: 'mobiliario', rifts: 'paisaje',
  sceneries: 'paisaje', sidewalks: 'mobiliario', 'signs_animalWarning': 'senales',
  'signs_backOfSigns': 'senales', 'signs_busStop': 'senales', 'signs_chevrons': 'senales',
  'signs_citySigns': 'toponimia', 'signs_directions': 'senales', 'signs_pedestrian': 'senales',
  'signs_railwayCrossing': 'senales', 'signs_roadNumbering': 'senales',
  'signs_signPosts': 'postes', 'signs_speed': 'senales', 'signs_stop': 'senales',
  'signs_streetNames': 'toponimia', 'signs_tramStop': 'senales', 'signs_yield': 'senales',
  snow: 'mobiliario', streetSuffix: 'toponimia', trafficLights: 'mobiliario',
  utilityPoles: 'postes', years: 'cobertura',
}

const NAME_TO_CODE = {
  'norway': 'no', 'sweden': 'se', 'finland': 'fi', 'denmark': 'dk', 'iceland': 'is',
  'estonia': 'ee', 'latvia': 'lv', 'lithuania': 'lt', 'poland': 'pl', 'germany': 'de',
  'netherlands': 'nl', 'the netherlands': 'nl', 'belgium': 'be', 'luxembourg': 'lu',
  'france': 'fr', 'spain': 'es', 'portugal': 'pt', 'italy': 'it', 'switzerland': 'ch',
  'austria': 'at', 'czechia': 'cz', 'czech republic': 'cz', 'slovakia': 'sk',
  'hungary': 'hu', 'romania': 'ro', 'bulgaria': 'bg', 'greece': 'gr', 'croatia': 'hr',
  'slovenia': 'si', 'serbia': 'rs', 'montenegro': 'me', 'north macedonia': 'mk',
  'albania': 'al', 'ukraine': 'ua', 'russia': 'ru', 'united kingdom': 'gb', 'uk': 'gb',
  'ireland': 'ie', 'malta': 'mt', 'cyprus': 'cy', 'georgia': 'ge', 'turkey': 'tr',
  'israel': 'il', 'jordan': 'jo', 'united arab emirates': 'ae', 'uae': 'ae',
  'qatar': 'qa', 'kazakhstan': 'kz', 'kyrgyzstan': 'kg', 'mongolia': 'mn', 'india': 'in',
  'sri lanka': 'lk', 'bangladesh': 'bd', 'bhutan': 'bt', 'nepal': 'np', 'thailand': 'th',
  'cambodia': 'kh', 'laos': 'la', 'vietnam': 'vn', 'malaysia': 'my', 'singapore': 'sg',
  'indonesia': 'id', 'philippines': 'ph', 'the philippines': 'ph', 'japan': 'jp',
  'south korea': 'kr', 'taiwan': 'tw', 'hong kong': 'hk', 'south africa': 'za',
  'lesotho': 'ls', 'eswatini': 'sz', 'botswana': 'bw', 'kenya': 'ke', 'uganda': 'ug',
  'ghana': 'gh', 'nigeria': 'ng', 'senegal': 'sn', 'tunisia': 'tn', 'madagascar': 'mg',
  'rwanda': 'rw', 'united states': 'us', 'usa': 'us', 'united states of america': 'us',
  'canada': 'ca', 'mexico': 'mx', 'guatemala': 'gt', 'dominican republic': 'do',
  'panama': 'pa', 'colombia': 'co', 'ecuador': 'ec', 'peru': 'pe', 'bolivia': 'bo',
  'brazil': 'br', 'argentina': 'ar', 'chile': 'cl', 'uruguay': 'uy', 'australia': 'au',
  'new zealand': 'nz', 'tanzania': 'tz', 'costa rica': 'cr', 'oman': 'om',
  'pakistan': 'pk', 'lebanon': 'lb', 'belarus': 'by', 'egypt': 'eg', 'iraq': 'iq',
  'andorra': 'ad', 'monaco': 'mc', 'liechtenstein': 'li', 'san marino': 'sm',
  'faroe islands': 'fo', 'greenland': 'gl', 'isle of man': 'im', 'jersey': 'je',
  'curacao': 'cw', 'curaçao': 'cw', 'martinique': 'mq', 'reunion': 're', 'réunion': 're',
  'puerto rico': 'pr', 'vanuatu': 'vu', 'macau': 'mo', 'macao': 'mo',
}

// Etiquetas en español para los grupos de /meta/lines (exterior · central)
const LINE_LABELS = {
  yellowWhite: 'Exterior amarilla · central blanca',
  whiteWhite: 'Exterior blanca · central blanca',
  whiteYellow: 'Exterior blanca · central amarilla',
  yellowYellow: 'Exterior amarilla · central amarilla',
  whiteWhiteYellow: 'Exterior blanca · central blanca y amarilla',
}

for (const file of await readdir(path.join(DIR, 'geohints')).catch(() => [])) {
  if (!file.endsWith('.json')) continue
  const d = JSON.parse(await readFile(path.join(DIR, 'geohints', file), 'utf8'))
  const bucket = GH_BUCKET[file.slice(0, -5)] ?? 'otros'
  if (d.kind === 'groups') {
    // solo las líneas se vuelcan al índice visual (la app las dibuja);
    // el resto de páginas agrupadas quedan en su JSON para usos futuros
    if (file === 'lines.json') {
      for (const g of d.groups) {
        for (const name of g.countries) {
          const code = NAME_TO_CODE[name.toLowerCase()] ?? null
          items.push({
            c: code,
            n: code ? undefined : name,
            s: 'h',
            k: 'lineas',
            g: g.id,
            t: LINE_LABELS[g.id] ?? g.label ?? g.id,
            i: null,
            l: d.sourceUrl,
          })
        }
      }
    }
    continue
  }
  for (const it of d.items ?? []) {
    const code = NAME_TO_CODE[it.country.trim().toLowerCase()] ?? null
    items.push({
      c: code,
      n: code ? undefined : it.country.trim(),
      s: 'h',
      k: bucket,
      t: '',
      i: it.image,
      l: it.link ?? d.sourceUrl,
    })
  }
}

const counts = {}
for (const it of items) counts[it.k] = (counts[it.k] ?? 0) + 1

await writeFile(
  path.join(DIR, 'visual-index.json'),
  JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), counts, items }),
)
console.log(`visual-index.json: ${items.length} elementos`, counts)
