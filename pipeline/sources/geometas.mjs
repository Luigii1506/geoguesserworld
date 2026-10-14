// Geometas — API JSON pública por país. La lista de países se descubre en la
// portada (enlaces /metas/countries/<slug>/), y cada respuesta trae su iso2.

import { fetchText, fetchJson } from '../lib/fetch.mjs'

export const meta = {
  id: 'geometas',
  name: 'Geometas',
  homepage: 'https://geometas.com/',
  license: 'Código MIT + Commons Clause; contenido sin licencia (deriva en parte de Plonk It). Uso personal.',
  method: 'API JSON pública /api/metas/countries/<slug>',
}

export async function run(ctx, sink) {
  const home = await fetchText(ctx, 'https://geometas.com/', { minIntervalMs: 800 })
  const slugs = [...new Set([...home.matchAll(/\/metas\/countries\/([a-z_]+)\//g)].map((m) => m[1]))]
  ctx.log(`${slugs.length} países descubiertos`)

  let countries = 0
  for (const slug of slugs) {
    let data
    try {
      data = await fetchJson(ctx, `https://geometas.com/api/metas/countries/${slug}`, {
        minIntervalMs: 800,
        accept404: true,
      })
    } catch (e) {
      ctx.warn(`${slug}: ${e.message}`)
      continue
    }
    if (!data?.metas?.length) continue
    for (const m of data.metas) {
      const [lat, lng] = (m.google_streetview_latlng ?? '').split(',').map(Number)
      sink.add({
        key: m.uuid,
        url: `https://geometas.com/metas/countries/${slug}/`,
        countryCode: m.country?.iso2 ?? data.country?.iso2,
        country: m.country?.name,
        label: m.category?.name,
        text: [m.answer, m.notes].filter(Boolean).join('\n\n'),
        images: [m.image_url],
        locationUrl: m.google_streetview_url ?? null,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        extra: { category: m.category?.slug ?? null, notes: m.notes || null },
      })
    }
    countries++
  }
  return { countries }
}
