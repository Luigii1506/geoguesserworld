// GeoTips — guías por país agrupadas en páginas regionales. Cada país es un
// <div data-original-id="HU" class="igm-map-content"> (el bloque que abre el
// mapa interactivo) con secciones <h4>: Bollard, Road Lines, Google Car...

import { fetchText } from '../lib/fetch.mjs'
import { htmlToText, absolutize } from '../lib/html.mjs'

export const meta = {
  id: 'geotips',
  name: 'GeoTips',
  homepage: 'https://geotips.net/',
  license: 'Sin licencia explícita (© GeoTips): todos los derechos reservados. Uso personal.',
  method: 'HTML de páginas regionales (bloques por país del mapa interactivo)',
}

const REGIONS = ['europe', 'asia', 'africa', 'north-america', 'south-america', 'oceania']

function images(html, base) {
  const out = []
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const src = tag.match(/data-src="([^"]+)"/)?.[1] ?? tag.match(/\ssrc="([^"]+)"/)?.[1]
    if (!src || src.startsWith('data:')) continue
    out.push(absolutize(src, base)?.replace(/^http:\/\//, 'https://'))
  }
  return out
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export async function run(ctx, sink) {
  let countries = 0
  for (const region of REGIONS) {
    const url = `https://geotips.net/${region}/`
    const html = await fetchText(ctx, url, { minIntervalMs: 2500, accept404: true })
    if (!html) {
      ctx.warn(`${region}: no encontrada`)
      continue
    }
    const blocks = html.split(/(?=<div data-original-id="[^"]*"[^>]*class="igm-map-content")/)
    for (const block of blocks.slice(1)) {
      const id = block.match(/data-original-id="([^"]*)"/)?.[1] ?? ''
      // el bloque termina donde empieza el siguiente; recortamos el pie de página
      const body = block.split(/<footer|<div[^>]+id="colophon"/)[0]
      const name = htmlToText(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '').trim()
      const target = /^[A-Z]{2}$/.test(id) ? { countryCode: id } : { country: name || id }

      const sections = body.split(/(?=<h4\b)/).slice(1)
      sections.forEach((sec, i) => {
        const title = htmlToText(sec.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1] ?? '').replace(/:\s*$/, '').trim()
        const content = sec.replace(/<h4[^>]*>[\s\S]*?<\/h4>/, '')
        const text = htmlToText(content.replace(/<noscript>[\s\S]*?<\/noscript>/gi, ''))
        const imgs = images(content.replace(/<noscript>[\s\S]*?<\/noscript>/gi, ''), url)
        if (!text && imgs.length === 0) return
        sink.add({
          key: `${id || slug(name)}:${i}-${slug(title)}`,
          url: `${url}#${id}`,
          ...target,
          label: title,
          title: `${name} · ${title}`,
          text,
          images: imgs,
          extra: { region },
        })
      })
      countries++
    }
    ctx.log(`${region}: ${blocks.length - 1} países`)
  }
  return { countries }
}
