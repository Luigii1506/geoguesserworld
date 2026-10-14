import { useEffect, useState } from 'react'

// Imágenes y resúmenes desde la API REST de Wikipedia en español.
// Contenido CC BY-SA con atribución (se muestra el enlace al artículo).
// Los redirects se resuelven solos, así que los títulos son tolerantes.

export interface WikiSummary {
  title: string
  extract: string
  thumb: string | null
  pageUrl: string
}

const LS_KEY = 'geomastery.wiki.v1'
const TTL = 1000 * 60 * 60 * 24 * 30 // 30 días

function readCache(): Record<string, { t: number; d: WikiSummary | null }> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, { t: number; d: WikiSummary | null }>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache))
  } catch {
    /* lleno o bloqueado: seguimos sin caché */
  }
}

const inflight = new Map<string, Promise<WikiSummary | null>>()

export async function fetchWiki(title: string): Promise<WikiSummary | null> {
  const cache = readCache()
  const hit = cache[title]
  if (hit && Date.now() - hit.t < TTL) return hit.d

  if (inflight.has(title)) return inflight.get(title)!

  const p = (async () => {
    try {
      const res = await fetch(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { accept: 'application/json', 'Api-User-Agent': 'GeoMastery/0.1 (app personal educativa)' } },
      )
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const summary: WikiSummary = {
        title: data.title ?? title,
        extract: data.extract ?? '',
        thumb: data.thumbnail?.source ?? null,
        pageUrl: data.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      }
      const c = readCache()
      c[title] = { t: Date.now(), d: summary }
      writeCache(c)
      return summary
    } catch {
      return null
    } finally {
      inflight.delete(title)
    }
  })()
  inflight.set(title, p)
  return p
}

/** Hook: resumen de Wikipedia; `enabled=false` pospone la petición (lazy). */
export function useWiki(title: string, enabled = true): WikiSummary | null | undefined {
  const [data, setData] = useState<WikiSummary | null | undefined>(undefined)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchWiki(title).then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [title, enabled])
  return enabled ? data : undefined
}

export interface PlaceWiki {
  title: string
  description: string | null
  extract: string
  image: string | null
  pageUrl: string
  lang: 'es' | 'en'
}

const placeCache = new Map<string, Promise<PlaceWiki | null>>()
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Artículo de Wikipedia de un lugar: se busca por coordenadas (geosearch) para no
 * confundir homónimos y se elige el que mejor coincide con el nombre; si no hay en
 * español, en inglés. Se guarda en localStorage como el resto de resúmenes.
 */
export function fetchPlaceWiki(name: string, lat: number, lng: number): Promise<PlaceWiki | null> {
  const key = `${name}|${lat.toFixed(3)}|${lng.toFixed(3)}`
  const cache = readCache() as unknown as Record<string, { t: number; d: PlaceWiki | null }>
  const hit = cache[`place:${key}`]
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.d)
  if (placeCache.has(key)) return placeCache.get(key)!
  const want = norm(name).split(' ').filter((w) => w.length > 2)
  const p = (async () => {
    for (const lang of ['es', 'en'] as const) {
      try {
        const geo = await fetch(
          `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
            action: 'query', list: 'geosearch', gscoord: `${lat}|${lng}`, gsradius: '10000', gslimit: '20', format: 'json', origin: '*',
          })}`,
        ).then((r) => r.json())
        const list: { title: string; dist: number }[] = geo?.query?.geosearch ?? []
        const scored = list
          .map((x) => ({ ...x, s: want.filter((w) => norm(x.title).includes(w)).length }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s || a.dist - b.dist)
        // también por título directo (estados, regiones grandes: su centro puede quedar lejos del artículo)
        const titles = [...scored.map((x) => x.title), name]
        for (const title of titles.slice(0, 3)) {
          const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
          if (!res.ok) continue
          const d = await res.json()
          if (d.type === 'disambiguation' || !d.extract) continue
          const out: PlaceWiki = {
            title: d.title, description: d.description ?? null, extract: d.extract, lang,
            image: d.originalimage?.source ?? d.thumbnail?.source ?? null,
            pageUrl: d.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
          }
          const c = readCache() as unknown as Record<string, { t: number; d: PlaceWiki | null }>
          c[`place:${key}`] = { t: Date.now(), d: out }
          writeCache(c as never)
          return out
        }
      } catch {
        /* sin red o sin artículo: siguiente idioma */
      }
    }
    return null
  })()
  placeCache.set(key, p)
  return p
}
