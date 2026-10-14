// OpenGuessr Education — el sitio bloquea clientes automatizados (403), pero
// todo su contenido está en su repositorio público de GitHub como páginas
// Svelte: artículos por país (intro + secciones con viñetas + panoramas) y
// guías generales. Se leen los .svelte en crudo desde raw.githubusercontent.

import { fetchJson, fetchText } from '../lib/fetch.mjs'
import { htmlToText, latLngFromMapsUrl } from '../lib/html.mjs'

export const meta = {
  id: 'openguessr',
  name: 'OpenGuessr Education',
  homepage: 'https://education.openguessr.com/',
  license: 'MIT + Commons Clause (© Paul Rhomberg | PaulPlay): uso no comercial con aviso de copyright.',
  method: 'Fuentes Svelte del repositorio público en GitHub',
}

const REPO = 'therealPaulPlay/OpenGuessrEducation'
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`

/** Divide un .svelte en bloques: intro, secciones <h2> con <li>, panoramas. */
function parseArticle(src) {
  const html = src.replace(/<script[\s\S]*?<\/script>/gi, '')
  const out = []
  const parts = html.split(/<h2[^>]*>([\s\S]*?)<\/h2>/)
  const intro = parts[0]
  const introText = htmlToText(intro.replace(/<ArticleEmbedPanorama[\s\S]*?\/>/g, ''))
  if (introText) out.push({ section: 'Overview', text: introText })

  for (let i = 1; i < parts.length; i += 2) {
    const section = htmlToText(parts[i])
    const body = parts[i + 1] ?? ''
    for (const li of body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const text = htmlToText(li[1])
      if (text) out.push({ section, text })
    }
    // párrafos sueltos de la sección (fuera de listas y panoramas)
    const loose = body
      .replace(/<ul[\s\S]*?<\/ul>/g, '')
      .replace(/<ArticleEmbedPanorama[\s\S]*?\/>\s*<p[^>]*>[\s\S]*?<\/p>/g, '')
    const looseText = htmlToText(loose)
    if (looseText) out.push({ section, text: looseText })
  }

  for (const m of html.matchAll(/<ArticleEmbedPanorama\s+src="([^"]+)"\s*\/>\s*(?:<p[^>]*>([\s\S]*?)<\/p>)?/g)) {
    const ll = latLngFromMapsUrl(m[1])
    out.push({ section: 'Panorama', text: htmlToText(m[2] ?? '') || 'Street View example', location: m[1], ll })
  }
  return out
}

export async function run(ctx, sink) {
  const tree = await fetchJson(ctx, `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, {
    minIntervalMs: 0,
    headers: { accept: 'application/vnd.github+json' },
  })
  const files = (tree.tree ?? []).map((t) => t.path)
  const countryPages = files.filter((p) => /^src\/routes\/countries\/learn\/[^/]+\/\+page\.svelte$/.test(p))
  const guidePages = files.filter((p) => /^src\/routes\/guides\/read\/.+\/\+page\.svelte$/.test(p))
  ctx.log(`${countryPages.length} artículos de país, ${guidePages.length} guías`)

  let n = 0
  for (const file of [...countryPages, ...guidePages]) {
    const src = await fetchText(ctx, RAW + file.split('/').map(encodeURIComponent).join('/'), { minIntervalMs: 250 })
    const isCountry = file.includes('/countries/learn/')
    const slug = file.split('/').at(-2)
    const pageUrl = isCountry
      ? `https://education.openguessr.com/countries/learn/${slug}`
      : `https://education.openguessr.com/${file.replace('src/routes/', '').replace('/+page.svelte', '')}`

    parseArticle(src).forEach((b, i) => {
      if (/^written by\b/i.test(b.text)) return
      const generic = /^(overview|strategies|details|locations)$/i.test(b.section)
      sink.add({
        key: `${file}#${i}`,
        url: pageUrl,
        ...(isCountry ? { country: slug.replace(/-/g, ' ') } : {}),
        // las secciones genéricas no describen el tema: se clasifica por texto
        label: generic ? (b.section.toLowerCase() === 'locations' ? 'locations' : null) : b.section,
        sourceLabel: b.section,
        title: isCountry ? null : slug.replace(/-/g, ' '),
        text: b.text,
        locationUrl: b.location ?? null,
        lat: b.ll?.lat,
        lng: b.ll?.lng,
        extra: { file, guide: !isCountry },
      })
    })
    n++
  }
  return { pages: n }
}
