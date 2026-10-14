#!/usr/bin/env node
// Importador de metas de Geometas — SOLO USO PERSONAL.
// Usa su API pública JSON (geometas.com/api/metas/countries/<slug>) y guarda
// public/community/geometas/<codigo>.json (carpeta fuera de git). Las imágenes
// se cargan en caliente desde su CDN. El contenido deriva de Plonk It según los
// créditos de Geometas: no redistribuir.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'public', 'community', 'geometas')

// slugs candidatos por código ISO (se prueba en orden hasta acertar)
const SLUGS = {
  no: ['norway'], se: ['sweden'], fi: ['finland'], dk: ['denmark'], is: ['iceland'],
  ee: ['estonia'], lv: ['latvia'], lt: ['lithuania'], pl: ['poland'], de: ['germany'],
  nl: ['netherlands', 'the_netherlands'], be: ['belgium'], lu: ['luxembourg'],
  fr: ['france'], es: ['spain'], pt: ['portugal'], it: ['italy'], ch: ['switzerland'],
  at: ['austria'], cz: ['czechia', 'czech_republic'], sk: ['slovakia'], hu: ['hungary'],
  ro: ['romania'], bg: ['bulgaria'], gr: ['greece'], hr: ['croatia'], si: ['slovenia'],
  rs: ['serbia'], me: ['montenegro'], mk: ['north_macedonia'], al: ['albania'],
  ua: ['ukraine'], ru: ['russia'], gb: ['united_kingdom', 'uk'], ie: ['ireland'],
  mt: ['malta'], cy: ['cyprus'], ge: ['georgia'], tr: ['turkey'], il: ['israel'],
  jo: ['jordan'], ae: ['united_arab_emirates', 'uae'], qa: ['qatar'],
  kz: ['kazakhstan'], kg: ['kyrgyzstan'], mn: ['mongolia'], in: ['india'],
  lk: ['sri_lanka'], bd: ['bangladesh'], bt: ['bhutan'], np: ['nepal'],
  th: ['thailand'], kh: ['cambodia'], la: ['laos'], vn: ['vietnam'],
  my: ['malaysia'], sg: ['singapore'], id: ['indonesia'], ph: ['philippines', 'the_philippines'],
  jp: ['japan'], kr: ['south_korea'], tw: ['taiwan'], hk: ['hong_kong'],
  za: ['south_africa'], ls: ['lesotho'], sz: ['eswatini'], bw: ['botswana'],
  ke: ['kenya'], ug: ['uganda'], gh: ['ghana'], ng: ['nigeria'], sn: ['senegal'],
  tn: ['tunisia'], mg: ['madagascar'], rw: ['rwanda'], us: ['united_states', 'usa'],
  ca: ['canada'], mx: ['mexico'], gt: ['guatemala'], do: ['dominican_republic'],
  pa: ['panama'], co: ['colombia'], ec: ['ecuador'], pe: ['peru'], bo: ['bolivia'],
  br: ['brazil'], ar: ['argentina'], cl: ['chile'], uy: ['uruguay'],
  au: ['australia'], nz: ['new_zealand'],
  tz: ['tanzania'], cr: ['costa_rica'], om: ['oman'], pk: ['pakistan'],
  lb: ['lebanon'], by: ['belarus'], eg: ['egypt'], iq: ['iraq'],
  ad: ['andorra'], mc: ['monaco'], li: ['liechtenstein'], sm: ['san_marino'],
  fo: ['faroe_islands'], gl: ['greenland'], im: ['isle_of_man'], je: ['jersey'],
  cw: ['curacao'], mq: ['martinique'], re: ['reunion'], pr: ['puerto_rico'],
  vu: ['vanuatu'], mo: ['macau', 'macao'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function tryFetch(slug) {
  const res = await fetch(`https://geometas.com/api/metas/countries/${slug}`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (!data?.metas?.length) return null
  return data
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const entries = Object.entries(SLUGS).filter(([code]) => only.length === 0 || only.includes(code))

await mkdir(OUT, { recursive: true })
let ok = 0, miss = 0
for (const [code, candidates] of entries) {
  let data = null, used = null
  for (const slug of candidates) {
    data = await tryFetch(slug)
    if (data) { used = slug; break }
    await sleep(350)
  }
  if (!data) {
    miss++
    console.warn(`✗ ${code}: sin metas (${candidates.join(', ')})`)
  } else {
    const out = {
      source: 'Geometas (contenido derivado de Plonk It según sus créditos)',
      sourceUrl: `https://geometas.com/metas/countries/${used}/`,
      license: 'Sin licencia de contenido. Importado para uso personal; no redistribuir.',
      importedAt: new Date().toISOString().slice(0, 10),
      metas: data.metas.map((m) => ({
        answer: m.answer ?? '',
        notes: m.notes ?? '',
        image: m.image_url ?? null,
        svUrl: m.google_streetview_url ?? null,
        svLatLng: m.google_streetview_latlng ?? null,
        category: m.category?.name ?? '',
      })),
    }
    await writeFile(path.join(OUT, `${code}.json`), JSON.stringify(out))
    ok++
    console.log(`✓ ${code} (${used}): ${out.metas.length} metas`)
  }
  await sleep(700)
}
console.log(`\nGeometas: ${ok} países importados, ${miss} sin datos → ${OUT}`)
