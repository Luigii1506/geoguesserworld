import { useState } from 'react'
import { geo, useGeo, type GeoCard } from '../../lib/geo'
import { PlaceMap } from '../ui'
import { CountryAtlas } from './CountryAtlas'

/** Mapa de terreno de un país con su propia carga y fichas: para usarlo en cualquier página. */
export function CountryTerrain({ cc }: { cc: string }) {
  const country = useGeo(`country:${cc}`, () => geo.country(cc))
  const [open, setOpen] = useState<GeoCard | null>(null)
  if (!country.data?.layers.length) return null
  return (
    <>
      <CountryAtlas country={country.data} onOpen={setOpen} />
      {open && (
        <PlaceMap places={[{ id: open.id, n: open.name_en ?? open.name, es: open.name, lat: open.lat, lng: open.lng, k: open.kind, cc: open.cc }]} index={0} onClose={() => setOpen(null)} />
      )}
    </>
  )
}
