import type { GeoCard, GeoCountryRow } from '../../lib/geo'
import { SORT, TAG_LABEL, factLine, kindLabel, volcanoStatus } from '../../lib/geoFormat'
import { Img } from '../Img'
import { SaveButton } from '../study/SaveButton'
import { placeItem } from '../../lib/study/items'

// Tarjeta de galería y fila de ranking de un lugar de la base geográfica.

type Countries = Map<string, GeoCountryRow>

function where(c: GeoCard, countries: Countries) {
  if (c.ccs && c.ccs.length > 1) return `${c.ccs.slice(0, 3).map((x) => countries.get(x)?.flag ?? '').join(' ')} ${c.ccs.length} países`
  const country = c.cc ? countries.get(c.cc) : undefined
  return country ? `${country.flag ?? ''} ${country.name}` : ''
}

export function GeoCardView({ c, countries, rank, onOpen }: { c: GeoCard; countries: Countries; rank?: number; onOpen: (c: GeoCard) => void }) {
  const status = volcanoStatus(c)
  const fact = factLine(c.kind, c.facts)
  return (
    <div className="geo-card-wrap">
    <button className={`geo-card ${c.thumb ? '' : 'noimg'}`} onClick={() => onOpen(c)}>
      <div className="geo-img">
        {c.thumb ? <Img src={c.thumb} /> : <span>{kindLabel(c.kind)}</span>}
        {rank ? <em className="geo-rank">{rank}</em> : <em className="geo-type">{kindLabel(c.kind)}</em>}
        {c.tags?.includes('unesco') && !rank ? <em className="geo-unesco">UNESCO</em> : null}
        {status ? <em className={`geo-vs geo-vs-${status}`}>{TAG_LABEL.get(status)}</em> : null}
        {fact && <em className="geo-fact">{fact}</em>}
      </div>
      <div className="geo-body">
        <strong>{c.name}</strong>
        <span className="geo-where-line">{where(c, countries)}</span>
        {c.descr && <span className="geo-desc">{c.descr}</span>}
      </div>
    </button>
    <span className="geo-save"><SaveButton compact item={placeItem(c)} /></span>
    </div>
  )
}

export function GeoRow({ c, countries, n, sort, max, onOpen }: {
  c: GeoCard
  countries: Countries
  n: number | null
  sort: string
  max: number
  onOpen: (c: GeoCard) => void
}) {
  const s = SORT.get(sort)
  const v = sort === 'hints' ? c.hints : c.value
  return (
    <li>
      <button className="geo-row" onClick={() => onOpen(c)}>
        <span className="geo-row-n">{n ?? '–'}</span>
        <span className="geo-row-img">{c.thumb ? <Img src={c.thumb} sizes="64px" /> : null}</span>
        <span className="geo-row-main">
          <strong>{c.name}</strong>
          <span>{where(c, countries)} · {kindLabel(c.kind)}{c.tags?.includes('unesco') ? ' · UNESCO' : ''}</span>
          {v != null && s?.format && max > 0 && (
            <span className="geo-bar-v"><span style={{ width: `${Math.max(3, (v / max) * 100)}%` }} /></span>
          )}
        </span>
        <span className="geo-row-val">{v != null && s?.format ? s.format(v) : factLine(c.kind, c.facts)}</span>
      </button>
    </li>
  )
}
