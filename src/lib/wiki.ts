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
