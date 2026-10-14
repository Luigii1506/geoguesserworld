// Resuelve nombres de país tal como los escribe cada fuente ("Czech Republic",
// "The Netherlands", "USA", "czech_republic", "israel-west-bank"...) al código
// ISO alfa-2 de la tabla countries. Los nombres no resueltos se acumulan para
// el informe, de modo que añadir un alias aquí arregla la fuente entera.

const MANUAL_ALIASES = {
  'czech republic': 'cz',
  'the netherlands': 'nl',
  'holland': 'nl',
  'usa': 'us',
  'us': 'us',
  'united states of america': 'us',
  'the united states': 'us',
  'uk': 'gb',
  'the united kingdom': 'gb',
  'great britain': 'gb',
  'england': 'gb',
  'scotland': 'gb',
  'wales': 'gb',
  'northern ireland': 'gb',
  'south korea': 'kr',
  'korea': 'kr',
  'russia': 'ru',
  'the philippines': 'ph',
  'uae': 'ae',
  'israel west bank': 'il',
  'israel and west bank': 'il',
  'west bank': 'ps',
  'palestine': 'ps',
  'turkey': 'tr',
  'turkiye': 'tr',
  'türkiye': 'tr',
  'antarctica mcmurdo station': 'aq',
  'macau': 'mo',
  'macao': 'mo',
  'eswatini': 'sz',
  'swaziland': 'sz',
  'north macedonia': 'mk',
  'macedonia': 'mk',
  'ivory coast': 'ci',
  'cote d ivoire': 'ci',
  'laos': 'la',
  'vietnam': 'vn',
  'curacao': 'cw',
  'reunion': 're',
  'us virgin islands': 'vi',
  'u s virgin islands': 'vi',
  'american samoa': 'as',
  'northern mariana islands': 'mp',
  'us minor outlying islands': 'um',
  'falkland islands': 'fk',
  'faroe islands': 'fo',
  'south georgia sandwich islands': 'gs',
  'south georgia and the south sandwich islands': 'gs',
  'saint pierre and miquelon': 'pm',
  'sao tome and principe': 'st',
  'british indian ocean territory': 'io',
  'cocos islands': 'cc',
  'cocos keeling islands': 'cc',
  'christmas island': 'cx',
  'pitcairn islands': 'pn',
  'svalbard': 'sj',
  'svalbard and jan mayen': 'sj',
  'vatican': 'va',
  'vatican city': 'va',
  'bosnia': 'ba',
  'bosnia and herzegovina': 'ba',
  'kosovo': 'xk',
  'czechia': 'cz',
  'hong kong': 'hk',
  'taiwan': 'tw',
  'democratic republic of the congo': 'cd',
  'dr congo': 'cd',
  'republic of the congo': 'cg',
}

// Territorios que algunas fuentes tratan como "país" propio pero que no tienen
// código ISO separado: se mapean al país y se conserva la región.
const SUBREGIONS = {
  alaska: { code: 'us', region: 'Alaska' },
  hawaii: { code: 'us', region: 'Hawaii' },
  azores: { code: 'pt', region: 'Azores' },
  madeira: { code: 'pt', region: 'Madeira' },
  'canary islands': { code: 'es', region: 'Canary Islands' },
  sardinia: { code: 'it', region: 'Sardinia' },
  sicily: { code: 'it', region: 'Sicily' },
  'providencia san andres': { code: 'co', region: 'San Andrés y Providencia' },
  'san andres': { code: 'co', region: 'San Andrés y Providencia' },
  'northwestern hawaiian islands': { code: 'us', region: 'Northwestern Hawaiian Islands' },
  'galapagos islands': { code: 'ec', region: 'Galápagos' },
  'the galapagos islands': { code: 'ec', region: 'Galápagos' },
  galapagos: { code: 'ec', region: 'Galápagos' },
  'midway atoll': { code: 'um', region: 'Midway Atoll' },
}

export function normalizeName(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-.,'’()&/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function createResolver(db) {
  const index = new Map()
  const rows = db.prepare('SELECT code, iso3, name, official_name, alt_names FROM countries').all()
  for (const r of rows) {
    const names = [r.name, r.official_name, ...(JSON.parse(r.alt_names || '[]'))]
    for (const n of names) if (n) index.set(normalizeName(n), r.code)
    index.set(r.code, r.code)
    if (r.iso3) index.set(r.iso3.toLowerCase(), r.code)
  }
  for (const [alias, code] of Object.entries(MANUAL_ALIASES)) index.set(normalizeName(alias), code)

  const unresolved = new Map()

  /** Igual que resolve() pero sin anotar fallos (para tanteos). */
  function lookup(raw) {
    if (!raw) return { code: null, region: null }
    const key = normalizeName(String(raw))
    const sub = SUBREGIONS[key]
    if (sub) return { code: sub.code, region: sub.region }
    return { code: index.get(key) ?? index.get(key.replace(/^the /, '')) ?? null, region: null }
  }

  /** @returns {{code: string|null, region: string|null}} */
  function resolve(raw) {
    const r = lookup(raw)
    if (raw && !r.code) unresolved.set(raw, (unresolved.get(raw) ?? 0) + 1)
    return r
  }

  const codes = new Set(rows.map((r) => r.code))
  return { resolve, lookup, unresolved, has: (code) => codes.has(code) }
}
