import { useEffect, useState } from 'react'

// Lector del contenido importado para uso personal (public/community/, fuera
// de git). Si los archivos no existen, la app funciona igual y ofrece el
// comando de importación.

export interface PlonkitTip {
  text: string
  image: string | null
  imageLink: string | null
  tags: string[]
}

export interface PlonkitGuide {
  source: string
  sourceUrl: string
  license: string
  importedAt: string
  title: string
  updatedAt: string | null
  hero: string | null
  sections: { title: string; tips: PlonkitTip[] }[]
}

export interface GeometasMeta {
  answer: string
  notes: string
  image: string | null
  svUrl: string | null
  svLatLng: string | null
  category: string
}

export interface GeometasPack {
  source: string
  sourceUrl: string
  license: string
  importedAt: string
  metas: GeometasMeta[]
}

const cache = new Map<string, unknown | null>()

async function fetchJson<T>(url: string): Promise<T | null> {
  if (cache.has(url)) return cache.get(url) as T | null
  try {
    const res = await fetch(url)
    const ct = res.headers.get('content-type') ?? ''
    // el dev server devuelve index.html para rutas inexistentes: exigir JSON
    const data = res.ok && ct.includes('json') ? ((await res.json()) as T) : null
    cache.set(url, data)
    return data
  } catch {
    cache.set(url, null)
    return null
  }
}

export function usePlonkitGuide(code: string): PlonkitGuide | null | undefined {
  const [guide, setGuide] = useState<PlonkitGuide | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetchJson<PlonkitGuide>(`/community/plonkit/${code}.json`).then((g) => {
      if (alive) setGuide(g)
    })
    return () => {
      alive = false
    }
  }, [code])
  return guide // undefined = cargando, null = no importado
}

export function useGeometas(code: string): GeometasPack | null | undefined {
  const [pack, setPack] = useState<GeometasPack | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    fetchJson<GeometasPack>(`/community/geometas/${code}.json`).then((g) => {
      if (alive) setPack(g)
    })
    return () => {
      alive = false
    }
  }, [code])
  return pack
}

export function plonkitImageUrl(rel: string): string {
  // plonkit.net exige su propio Referer para servir imágenes: pasan por el
  // proxy /pi-img del servidor de Vite (ver vite.config.ts)
  return rel.startsWith('http') ? rel : `/pi-img${rel}`
}
