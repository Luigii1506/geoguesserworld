#!/usr/bin/env node
// Importador de guías de Plonk It — SOLO USO PERSONAL.
// Descarga el JSON embebido en cada página de guía (script __PRELOADED_DATA__)
// y lo guarda en public/community/plonkit/<codigo>.json (carpeta fuera de git).
// Las imágenes NO se descargan: la app las carga en caliente desde plonkit.net,
// igual que haría tu navegador al visitar la guía. No publiques este contenido.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'public', 'community', 'plonkit')

// código ISO nuestro → slug de plonkit.net (mismo mapa que src/data/plonkit.ts)
const SLUGS = {
  no: 'norway', se: 'sweden', fi: 'finland', dk: 'denmark', is: 'iceland',
  ee: 'estonia', lv: 'latvia', lt: 'lithuania', pl: 'poland', de: 'germany',
  nl: 'netherlands', be: 'belgium', lu: 'luxembourg', fr: 'france', es: 'spain',
  pt: 'portugal', it: 'italy', ch: 'switzerland', at: 'austria', cz: 'czechia',
  sk: 'slovakia', hu: 'hungary', ro: 'romania', bg: 'bulgaria', gr: 'greece',
  hr: 'croatia', si: 'slovenia', rs: 'serbia', me: 'montenegro', mk: 'north-macedonia',
  al: 'albania', ua: 'ukraine', ru: 'russia', gb: 'united-kingdom', ie: 'ireland',
  mt: 'malta', cy: 'cyprus', tr: 'turkey', ge: 'georgia', il: 'israel-west-bank',
  jo: 'jordan', ae: 'united-arab-emirates', qa: 'qatar', kz: 'kazakhstan',
  kg: 'kyrgyzstan', mn: 'mongolia', in: 'india', lk: 'sri-lanka', bd: 'bangladesh',
  bt: 'bhutan', np: 'nepal', th: 'thailand', kh: 'cambodia', la: 'laos',
  vn: 'vietnam', my: 'malaysia', sg: 'singapore', id: 'indonesia', ph: 'philippines',
  jp: 'japan', kr: 'south-korea', tw: 'taiwan', hk: 'hong-kong', za: 'south-africa',
  ls: 'lesotho', sz: 'eswatini', bw: 'botswana', ke: 'kenya', ug: 'uganda',
  gh: 'ghana', ng: 'nigeria', sn: 'senegal', tn: 'tunisia', mg: 'madagascar',
  rw: 'rwanda', us: 'united-states', ca: 'canada', mx: 'mexico', gt: 'guatemala',
  do: 'dominican-republic', pa: 'panama', co: 'colombia', ec: 'ecuador',
  pe: 'peru', bo: 'bolivia', br: 'brazil', ar: 'argentina', cl: 'chile',
  uy: 'uruguay', au: 'australia', nz: 'new-zealand',
  tz: 'tanzania', cr: 'costa-rica', om: 'oman', pk: 'pakistan', lb: 'lebanon',
  by: 'belarus', eg: 'egypt', iq: 'iraq', ad: 'andorra', mc: 'monaco',
  li: 'liechtenstein', sm: 'san-marino', fo: 'faroe-islands', gl: 'greenland',
  im: 'isle-of-man', je: 'jersey', cw: 'curacao', mq: 'martinique',
  re: 'reunion', pr: 'puerto-rico', vu: 'vanuatu', mo: 'macau',
}

const UA = 'GeoMastery-personal/0.1 (importador de uso personal; contacto: usuario local)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function simplifyItems(items) {
  const tips = []
  for (const item of items ?? []) {
    if (item.kind === 'tip' && item.data) {
      tips.push({
        text: (item.data.text ?? []).join('\n\n'),
        image: item.data.image?.imageUrl ?? null,
        imageLink: item.data.image?.imageLink ?? null,
        tags: item.tags ?? [],
      })
    } else if (item.kind === 'centeredImage' && item.imageUrl) {
      tips.push({ text: '', image: item.imageUrl, imageLink: null, tags: [] })
    }
  }
  return tips
}

async function fetchWithRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (res.ok) return res
    if (res.status === 429 && i < tries - 1) {
      await sleep(8000 * (i + 1)) // espera creciente ante rate-limit
      continue
    }
    throw new Error(`HTTP ${res.status}`)
  }
  throw new Error('agotados los reintentos')
}

async function importCountry(code, slug) {
  const res = await fetchWithRetry(`https://www.plonkit.net/${slug}`)
  const html = await res.text()
  const m = html.match(/__PRELOADED_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (!m) throw new Error('sin __PRELOADED_DATA__')
  const parsed = JSON.parse(m[1])
  const pub = parsed?.data?.public
  if (!pub?.steps) throw new Error('estructura inesperada')
  const out = {
    source: 'Plonk It',
    sourceUrl: `https://www.plonkit.net/${slug}`,
    license: 'Todos los derechos reservados. Importado para uso personal; no redistribuir.',
    importedAt: new Date().toISOString().slice(0, 10),
    title: pub.title,
    updatedAt: pub.updatedAt ?? null,
    hero: pub.heroImage ?? null,
    sections: (pub.steps ?? []).map((s) => ({ title: s.title ?? '', tips: simplifyItems(s.items) })),
  }
  await writeFile(path.join(OUT, `${code}.json`), JSON.stringify(out))
  return out.sections.reduce((a, s) => a + s.tips.length, 0)
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const entries = Object.entries(SLUGS).filter(([code]) => only.length === 0 || only.includes(code))

await mkdir(OUT, { recursive: true })
let ok = 0, fail = 0
for (const [code, slug] of entries) {
  try {
    const n = await importCountry(code, slug)
    ok++
    console.log(`✓ ${code} (${slug}): ${n} tips`)
  } catch (e) {
    fail++
    console.warn(`✗ ${code} (${slug}): ${e.message}`)
  }
  await sleep(2600) // despacio: su servidor devuelve 429 si vas más rápido
}
console.log(`\nPlonk It: ${ok} guías importadas, ${fail} fallos → ${OUT}`)
