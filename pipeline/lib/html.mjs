// Utilidades mínimas para convertir HTML/Markdown de las fuentes en texto
// plano legible, conservando párrafos y viñetas.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', deg: '°', middot: '·', times: '×',
}

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

/** HTML → texto plano: <br>/<p>/<li> se convierten en saltos de línea. */
export function htmlToText(html) {
  if (!html) return ''
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Markdown ligero (Plonk It) → texto plano conservando el contenido de enlaces. */
export function markdownToText(md) {
  if (!md) return ''
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Enlaces Markdown [texto](url) de un texto, en orden y sin repetir. */
export function markdownLinks(md) {
  const out = []
  const seen = new Set()
  for (const m of (md ?? '').matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (seen.has(m[2])) continue
    seen.add(m[2])
    out.push({ text: m[1].replace(/\*\*/g, '').trim(), url: m[2] })
  }
  return out
}

export function absolutize(url, base) {
  if (!url) return null
  try {
    return new URL(url, base).toString()
  } catch {
    return null
  }
}

/** Extrae lat/lng de URLs de Google Maps (@lat,lng · viewpoint · !1d…!2d… · ll=). */
export function latLngFromMapsUrl(url) {
  if (!url) return null
  const m =
    url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    url.match(/viewpoint=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    url.match(/[?&](?:ll|q|cbll)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) }
  const e = url.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/)
  if (e) return { lat: Number(e[1]), lng: Number(e[2]) }
  return null
}
