// Plonk It — guías por país (~140). Cada página trae su contenido completo
// como JSON en <script id="__PRELOADED_DATA__">, igual que el índice /guide.
//
// Se extrae TODO lo que muestra la página:
//   · tips (texto + imagen + enlace a la ubicación + enlaces a ejemplos dentro del texto)
//   · bloques de texto sueltos (centeredText, text, notes, centeredImageWithCaption)
//   · subtítulos de subsección, como contexto de los tips que siguen
//   · la sección "Maps and resources" (mapas de GeoGuessr recomendados)
//   · los recursos de la comunidad (communityDocs)

import { fetchText } from '../lib/fetch.mjs'
import { markdownToText, markdownLinks, latLngFromMapsUrl } from '../lib/html.mjs'

export const meta = {
  id: 'plonkit',
  name: 'Plonk It',
  homepage: 'https://www.plonkit.net/guide',
  license: 'Sin licencia explícita: todos los derechos reservados. Uso personal.',
  method: 'JSON embebido en cada página (__PRELOADED_DATA__)',
}

const BASE = 'https://www.plonkit.net'
const SKIP = new Set(['beginners-guide', 'maps', 'middle-earth', 'spillover-countries'])
const SUBREGION_SLUGS = new Set(['alaska', 'hawaii', 'azores', 'madeira'])
const TEXT_BLOCKS = new Set(['centeredText', 'text', 'notes', 'centeredImageWithCaption'])

// Etiquetas propias de Plonk It → taxonomía (más fiable que las reglas genéricas)
const TAG_MAP = {
  pole: { category: 'poles' },
  bollard: { category: 'bollards' },
  landscape: { category: 'landscape' },
  vegetation: { category: 'landscape' },
  'chevron/sign': { category: 'signs' },
  coverage: { category: 'google_car' },
  architecture: { category: 'architecture' },
  guardrail: { category: 'guardrails' },
  language: { category: 'language' },
  roadline: { category: 'road_lines' },
  'license plates': { category: 'plates' },
}

function preloaded(html) {
  const m = html.match(/<script id="__PRELOADED_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  return m ? JSON.parse(m[1]) : null
}

const abs = (u) => (u ? (u.startsWith('http') ? u : BASE + u) : null)
const asLines = (t) => (Array.isArray(t) ? t : t ? [t] : [])

export async function run(ctx, sink) {
  const index = preloaded(await fetchText(ctx, `${BASE}/guide`, { minIntervalMs: 2600 }))
  const guides = (index?.data ?? []).filter((g) => !SKIP.has(g.slug))
  ctx.log(`${guides.length} guías en el índice`)

  const counts = { tips: 0, textBlocks: 0, links: 0, resources: 0, mapSections: 0 }
  let done = 0
  for (const g of guides) {
    const url = `${BASE}/${g.slug}`
    let data
    try {
      data = preloaded(await fetchText(ctx, url, { minIntervalMs: 2600 }))?.data
    } catch (e) {
      ctx.warn(`${g.slug}: ${e.message}`)
      continue
    }
    const page = data?.public
    if (!page?.steps) {
      ctx.warn(`${g.slug}: sin contenido`)
      continue
    }
    // Alaska, Hawái, Azores y Madeira tienen guía propia pero no código ISO:
    // el resolvedor los asigna a su país conservando la región.
    const country = SUBREGION_SLUGS.has(g.slug)
      ? { country: g.slug }
      : g.code && g.code.length === 2
        ? { countryCode: g.code }
        : { country: g.title }

    // ── recursos de la comunidad: "[Título](url) by Autor" ──
    for (const doc of data.communityDocs ?? []) {
      const author = doc.match(/\)\s*by\s+(.+?)\s*$/)?.[1] ?? null
      for (const l of markdownLinks(doc)) {
        sink.resource({ ...country, url: l.url, title: l.text, author, kind: 'community_doc' })
        counts.resources++
      }
    }

    page.steps.forEach((step, si) => {
      // ── sección "Maps and resources": texto + mapas de GeoGuessr recomendados ──
      if (step.kind === 'map' && step.text) {
        const raw = asLines(step.text).join('\n')
        const links = markdownLinks(raw)
        sink.add({
          key: `${g.slug}:map-${si}`,
          url,
          ...country,
          category: { category: 'general' },
          sourceLabel: step.title ?? 'Maps and resources',
          text: markdownToText(raw),
          extra: { section: step.title ?? null, kind: 'map', links },
        })
        // cada línea: "- **A Balanced Mexico** ([map link](url)) - 23k locations…":
        // el nombre va en negrita y la descripción detrás del enlace
        for (const line of asLines(step.text)) {
          const name = line.match(/\*\*(.+?)\*\*/)?.[1]?.trim()
          const note = markdownToText(line.replace(/^.*?\]\([^)]*\)\)?\s*[-–—:]?\s*/, '')).trim()
          for (const l of markdownLinks(line))
            sink.resource({
              ...country,
              url: l.url,
              title: name && !/^map link$/i.test(name) ? name : l.text,
              note: note && note !== line ? note : null,
              kind: /geoguessr\.com\/maps/.test(l.url) ? 'practice_map' : 'other',
            })
        }
        counts.mapSections++
        counts.resources += links.length
      }

      let subsection = null
      ;(step.items ?? []).forEach((item, ii) => {
        if (item.kind === 'subsection') {
          subsection = item.title ?? null
          return
        }
        if (item.kind === 'divider') return
        const label = [step.title, subsection].filter(Boolean).join(' › ') || null

        // ── bloques de texto sueltos ──
        if (TEXT_BLOCKS.has(item.kind)) {
          const raw = asLines(item.text).join('\n\n')
          const text = markdownToText(raw)
          const image = abs(item.image?.imageUrl)
          if (!text && !image) return
          sink.add({
            key: `${g.slug}:${item.id ?? `${si}-${ii}`}`,
            url,
            ...country,
            sourceLabel: label,
            fallbackLabel: label,
            text,
            images: image ? [image] : [],
            extra: { section: step.title ?? null, subsection, kind: item.kind, links: markdownLinks(raw) },
          })
          counts.textBlocks++
          return
        }

        // ── tips e imágenes centradas ──
        const data = item.data ?? {}
        const raw = asLines(data.text).join('\n\n')
        const images = [
          ...(data.image?.imageUrl ? [data.image.imageUrl] : []),
          ...(Array.isArray(data.images) ? data.images.map((im) => im.imageUrl ?? im) : []),
          ...(item.imageUrl ? [item.imageUrl] : []),
        ].map(abs)
        const text = markdownToText(raw)
        if (!text && images.length === 0) return

        const tags = item.tags ?? []
        const mapped = tags.map((t) => TAG_MAP[t]).find(Boolean)
        const link = data.image?.imageLink && data.image.imageLink !== '#' ? data.image.imageLink : null
        const ll = latLngFromMapsUrl(link)
        const links = markdownLinks(raw)
        counts.links += links.length
        counts.tips++
        sink.add({
          key: `${g.slug}:${item.id ?? `${si}-${ii}`}`,
          url,
          ...country,
          // el título de sección ("Identifying Kenya") no describe el tema del
          // tip: se clasifica por tags y texto, y solo en último caso por la
          // sección ("Regional clues" → regiones, "Pinpointable" → lugares)
          sourceLabel: label,
          fallbackLabel: label,
          tags,
          category: mapped,
          text,
          images,
          locationUrl: link && !/\.(png|jpe?g|webp|gif)$/i.test(link) ? link : null,
          lat: ll?.lat,
          lng: ll?.lng,
          extra: {
            section: step.title ?? null,
            subsection,
            kind: item.kind,
            // posición en la guía: la primera imagen centrada es la infografía resumen del país
            order: si * 1000 + ii,
            important: tags.includes('important'),
            links,
          },
        })
      })
    })
    done++
    if (done % 20 === 0) ctx.log(`${done}/${guides.length} guías`)
  }
  return { guides: done, ...counts }
}
