// Guías externas: enlaces (no copias) a lo que la comunidad ha publicado para cada país.
// La lista viene de la «Regionguessing Meta Library» de Lupus (Discord: l.upus), una hoja
// de Google con ~830 documentos, mapas, infografías y vídeos ordenados por país, cada uno
// con su autor, tipo, tiempo de lectura, nivel y utilidad. Se guarda solo lo necesario para
// enlazarlos; la descripción, traducida al español (phrase_translations, con caché).
//
//   npm run pipeline -- resources            (--refresh para volver a descargar la hoja)
//
// Escribe public/community/resources.json (se publica con `geo publish community`).

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createResolver } from './lib/countries.mjs'
import { BROWSER_UA } from './lib/fetch.mjs'
import { RAW_DIR, ROOT } from './lib/paths.mjs'
import { readWorkbook } from './lib/xlsx.mjs'
import { phraseTranslator, translatePhraseList } from './translate-phrases.mjs'

const SHEET_ID = '1UNvkoY-LaktF75nU_cP7-wVRAEvH3fSqVZet20HqxXA'
export const LIBRARY = {
  name: 'Regionguessing Meta Library',
  author: 'Lupus (Discord: l.upus)',
  url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
}

// recursos generales (los que la hoja recomienda para cualquier país), descritos aquí
const GENERAL = [
  { t: 'Plonk It', u: 'https://www.plonkit.net/guide', d: 'La guía de referencia de la comunidad: una ficha por país con lo más rentable para reconocerlo. Por aquí se empieza.' },
  { t: 'Servidor de Discord de Plonk It', u: 'https://discord.gg/P52HKfCKBb', d: 'Muchos enlaces de la biblioteca son mensajes o archivos de este servidor: entra para poder abrirlos.' },
  { t: 'super-duper.fr', u: 'https://super-duper.fr/index_en.php', d: 'Mapas y quizzes por país: matrículas, prefijos, señales y regiones.' },
  { t: 'Emily · mapas y quizzes', u: 'https://geo.emily.bz/', d: 'Quizzes de mapas para casi todos los países (subdivisiones, prefijos telefónicos…) y mapas de cobertura.' },
  { t: 'Helloquiz', u: 'https://helloquiz.app/', d: 'Quizzes rápidos de subdivisiones y otros datos por país.' },
  { t: 'Learnable Meta', u: 'https://learnablemeta.com/', d: 'Mapas con una nota por ubicación que se ve al jugar: la meta en contexto.' },
  { t: 'GeoCoach', u: 'https://www.geocoach.me/', d: 'Entrenamiento por país con ejercicios.' },
  { t: 'Sistemas de numeración de carreteras', u: 'https://sites.google.com/site/roadnumberingsystems/home', d: 'Cómo se numeran las carreteras en cada país; útil sobre todo en partidas con movimiento.' },
]

// la hoja usa estos nombres; el resto se resuelve con los alias de países de siempre
const NAMES = { UAE: 'ae', USA: 'us', NMI: 'mp', 'Cocos Islands': 'cc', 'US Virgin Islands': 'vi', Türkiye: 'tr', Curacao: 'cw', Macau: 'mo', 'São Tomé & Príncipe': 'st' }
const TYPES = {
  Document: 'doc', Slideshow: 'slides', Map: 'map', 'Map json': 'mapjson', 'Scribble Map': 'map', Infographic: 'infographic',
  'Video guide': 'video', Spreadsheet: 'sheet', Post: 'post', List: 'list',
}
// la hoja repite la misma presentación de Plonk It en cada país: basta una línea
const PLONKIT = 'La ficha de Plonk It de este país: lo más rentable para reconocerlo, con buenos ejemplos. El punto de partida.'
const LEVEL = { '🌑': 'basic', '🌗': 'all', '🌕': 'advanced' }
const USE = { '‼️': 'new', '❕': 'some', '❔': 'niche', '❌': 'old', '♻️': 'repeat' }

async function download(refresh) {
  const dir = path.join(RAW_DIR, 'resources')
  const file = path.join(dir, 'regionguessing-meta-library.xlsx')
  const unzipped = path.join(dir, 'xlsx')
  if (refresh || !existsSync(file)) {
    mkdirSync(dir, { recursive: true })
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`, { headers: { 'user-agent': BROWSER_UA } })
    if (!res.ok) throw new Error(`no se pudo descargar la hoja: ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    rmSync(unzipped, { recursive: true, force: true })
  }
  if (!existsSync(unzipped)) execFileSync('unzip', ['-q', '-o', file, '-d', unzipped])
  return unzipped
}

const text = (c) => (c == null ? '' : typeof c === 'string' ? c : c.text).trim()
const link = (c) => (c && typeof c === 'object' ? c.link : undefined)

export async function resources(db, { refresh = false, model } = {}) {
  const book = readWorkbook(await download(refresh))
  const resolver = createResolver(db)
  const countries = {}
  const unresolved = []
  for (const { name, rows } of book.filter((s) => /\(\d+\)$/.test(s.name))) {
    const continent = name.replace(/\s*\(\d+\)$/, '')
    let entry = null
    let last = null
    for (const [, r] of rows) {
      const head = text(r.A)
      if (/\(\d+\)$/.test(head)) {
        const raw = head.replace(/\s*\(\d+\)$/, '').trim()
        const cc = NAMES[raw] ?? resolver.lookup(raw).code
        if (!cc) unresolved.push(raw)
        entry = cc ? (countries[cc] ??= { continent, items: [] }) : null
        last = null
      }
      if (!entry) continue
      // fila final de cada país: el enlace a su mapa de prefijos telefónicos
      if (text(r.B) === 'Area codes') {
        if (link(r.B)) entry.areaCodes = link(r.B)
        continue
      }
      if (!r.D) continue
      const t = text(r.D)
      const u = link(r.D)
      // sin autor ni descripción: otra parte del recurso de arriba («Class II and III roads»)
      if (!r.E && !r.G && last) {
        if (u) (last.parts ??= []).push({ t, u })
        continue
      }
      if (!u) continue
      const marks = text(r.B)
      const [type, time] = text(r.F).split('\n')
      const minutes = time?.match(/(?:(\d+)\s*h)?\s*(\d+)?\s*min/)
      last = {
        t,
        u,
        a: text(r.E).replace(/\n/g, ' ') || undefined,
        k: TYPES[type?.trim()] ?? 'other',
        m: minutes ? Number(minutes[1] ?? 0) * 60 + Number(minutes[2] ?? 0) || undefined : undefined,
        d: text(r.G).replace(/\s*\n\s*/g, ' ') || undefined,
        lv: Object.entries(LEVEL).find(([e]) => marks.includes(e))?.[1],
        use: USE[text(r.C)],
        start: marks.includes('🚩') || undefined,
        // enlaces de archivos de Discord: caducan (la hoja lo avisa en rojo)
        dc: /cdn\.discordapp\.com|media\.discordapp\.net/.test(u) || undefined,
      }
      entry.items.push(last)
    }
  }
  if (unresolved.length) console.warn(`[resources] países sin resolver: ${unresolved.join(', ')}`)

  // descripciones en español
  const descs = Object.values(countries).flatMap((c) => c.items.filter((i) => i.a !== 'Plonk It team').map((i) => i.d).filter(Boolean))
  await translatePhraseList(db, descs, { model })
  const es = phraseTranslator(db)
  for (const c of Object.values(countries)) for (const i of c.items) i.d = i.a === 'Plonk It team' ? PLONKIT : i.d && es(i.d)

  const out = path.join(ROOT, 'public', 'community', 'resources.json')
  mkdirSync(path.dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), library: LIBRARY, general: GENERAL, countries }))
  const n = Object.values(countries).reduce((a, c) => a + c.items.length, 0)
  console.log(`[resources] ✓ ${n} guías de ${Object.keys(countries).length} países → ${path.relative(ROOT, out)}`)
}
