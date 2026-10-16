import { useEffect, useMemo, useRef, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import STRIPS from '../../../geo/strips.json'
import { geo, geoAssetUrl, useGeo, type GeoCard, type GeoCountry, type GeoLayer } from '../../lib/geo'
import { nf } from '../../lib/geoFormat'

// Mapa de terreno de un país: relieve, llanuras y montañas, vegetación,
// cultivos y clima (imágenes del pipeline, en Mercator) con sus contornos,
// ríos, lagos, cordilleras y ciudades encima. La leyenda dice cuánto ocupa
// cada cosa; al elegir una, los estados se tiñen según dónde hay más.

type Props = { country: GeoCountry; onOpen: (c: GeoCard) => void }
type Shape = { id: string | null; name: string; d: string; c: [number, number]; props: Record<string, unknown> }
type Focus = { key: string; scope: string; label: string; color: string } | null

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const pct = (v: number) => (v >= 0.1 ? `${Math.round(v * 100)} %` : v >= 0.005 ? `${(v * 100).toLocaleString('es', { maximumFractionDigits: 1 })} %` : '<1 %')
const tonnes = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('es', { maximumFractionDigits: 1 })} M t` : `${nf(Math.round(v / 1000))} mil t`)

/** Proyección exacta del marco de la imagen: sus esquinas caen en (0,0) y (W,H). */
function frameProjection(bbox: [number, number, number, number], width: number) {
  const [w, , e, n] = bbox
  const k = width / (((e - w) * Math.PI) / 180)
  return geoMercator().scale(k).translate([(-w * Math.PI * k) / 180, k * mercY(n)])
}

function useTopo(path: string | undefined) {
  const [topo, setTopo] = useState<Topology | null>(null)
  useEffect(() => {
    setTopo(null)
    if (!path) return
    let alive = true
    fetch(geoAssetUrl(path)).then((r) => (r.ok ? r.json() : null)).then((t) => alive && setTopo(t))
    return () => {
      alive = false
    }
  }, [path])
  return topo
}

export function CountryAtlas({ country, onOpen }: Props) {
  const meta = useGeo('meta', geo.meta)
  const assets = new Map(country.layers.map((l) => [l.id, l]))
  const vectorAsset = assets.get('vector')
  const rasterLayers = (meta.data?.layers ?? []).filter((l) => l.kind === 'raster' && assets.has(l.id))
  const [layerId, setLayerId] = useState<string>('')
  const [focus, setFocus] = useState<Focus>(null)
  const [hover, setHover] = useState<{ name: string; value?: string; x: number; y: number } | null>(null)
  const layer: GeoLayer | undefined = rasterLayers.find((l) => l.id === layerId) ?? rasterLayers[0]
  const asset = layer ? assets.get(layer.id) : undefined
  const frame = vectorAsset ?? asset
  // vector ligero para la vista inicial; el detallado, al acercar (zoom ≥ 2)
  const [detailed, setDetailed] = useState(false)
  const litePath = vectorAsset?.path.replace(/\.json(\?|$)/, '.lite.json$1')
  const liteTopo = useTopo(litePath)
  const fullTopo = useTopo(detailed ? vectorAsset?.path : undefined)
  const topo = fullTopo ?? liteTopo
  // ciudades = áreas urbanas (GHSL): una por aglomeración, sin alcaldías ni barrios sueltos
  const cities = useGeo(`atlas-cities:${country.cc}`, () => geo.list({ cc: country.cc, ...STRIPS.atlasCities }))
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>()
  const [k, setK] = useState(1)
  const [px, setPx] = useState(1)

  useEffect(() => setFocus(null), [layer?.id, country.cc])
  useEffect(() => setDetailed(false), [country.cc])

  const W = frame?.width ?? 1000
  const H = frame?.height ?? 700
  const projection = useMemo(() => (frame ? frameProjection(frame.bbox, frame.width) : null), [frame])
  const shapes = useMemo(() => {
    if (!topo || !projection) return null
    const path = geoPath(projection)
    const read = (name: string): Shape[] => {
      const obj = topo.objects[name]
      if (!obj) return []
      const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry, Record<string, unknown>>
      return fc.features.map((f: Feature<Geometry, Record<string, unknown>>) => ({
        id: (f.properties?.id as string) ?? null, name: (f.properties?.name as string) ?? '', d: path(f) ?? '',
        c: path.centroid(f) as [number, number], props: f.properties ?? {},
      }))
    }
    return { country: read('country'), admin1: read('admin1'), ranges: read('ranges'), regions: read('regions'), lakes: read('lakes'), rivers: read('rivers'), seas: read('seas') }
  }, [topo, projection])

  // unidades del viewBox por píxel de pantalla
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ro = new ResizeObserver(() => setPx(W / Math.max(1, svg.clientWidth)))
    ro.observe(svg)
    return () => ro.disconnect()
  }, [W, !!meta.data, !!frame])

  // zoom y desplazamiento (rueda, pellizco, arrastre)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (ev) => {
        select(gRef.current).attr('transform', ev.transform.toString())
        setK(ev.transform.k)
        if (ev.transform.k >= 2) setDetailed(true)
      })
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    select(svg).call(z.transform, zoomIdentity)
    return () => void select(svg).on('.zoom', null)
  }, [W, H, country.cc, !!meta.data, !!frame])

  if (!meta.data || !layer || !frame || !asset) return null

  // reparto en el país de la capa elegida (fracciones o toneladas)
  const ownFacts = country.entity.facts.filter((f) => f.key.startsWith(`${layer.id}:`) && typeof f.value === 'number')
  const shareOf = new Map(ownFacts.filter((f) => f.scope === 'share').map((f) => [f.key.slice(layer.id.length + 1), f.value as number]))
  const legend = layer.legend
    .filter((l) => layer.id === 'relief' || (shareOf.get(l.key) ?? 0) > 0)
    .sort((a, b) => (layer.id === 'relief' ? 0 : (shareOf.get(b.key) ?? 0) - (shareOf.get(a.key) ?? 0)))
  const topCrops = layer.id === 'crops'
    ? ownFacts.filter((f) => f.scope === 'tonnes').sort((a, b) => (b.value as number) - (a.value as number)).slice(0, 10)
    : []
  const cropName = (code: string) => (layer.legend as { key: string; label: string; kind?: string }[]).find((l) => l.key === code && l.kind === 'item')?.label ?? code.toUpperCase()

  // valor de cada estado para la clase elegida
  const regionValue = (id: string | null) => {
    if (!focus || !id) return undefined
    return country.regions.find((r) => r.id === id)?.terrain?.[`${layer.id}:${focus.key}@${focus.scope}`]
  }
  const ranked = focus
    ? country.regions
        .map((r) => ({ r, v: r.terrain?.[`${layer.id}:${focus.key}@${focus.scope}`] ?? 0 }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v)
    : []
  const total = focus?.scope === 'tonnes' ? ranked.reduce((s, x) => s + x.v, 0) : 0
  const max = ranked[0]?.v ?? 0
  const fmt = (v: number) => (focus?.scope === 'tonnes' ? `${tonnes(v)} · ${pct(v / Math.max(1, total))}` : pct(v))

  const showLand = layer.id === 'relief' || layer.id === 'landform'
  const relief = layer.id === 'relief'
  const elevMean = country.entity.facts.find((f) => f.key === 'relief:mean')?.value as number | undefined
  const top = country.highest
  // grosores y letras en píxeles de pantalla: el viewBox se escala al ancho real y el zoom amplía
  const sw = px / k
  // tarjeta mínima para abrir la ficha de una forma del mapa (la ficha completa la trae la API)
  const stub = (s: Shape, kind: string): GeoCard => {
    const [lng, lat] = projection?.invert?.(s.c) ?? [0, 0]
    return { id: s.id!, kind, name: s.name, lat, lng, fame: 0, rank: 0, hints: 0, cc: country.cc }
  }
  // etiquetas sin solaparse: primero las ciudades más pobladas, luego cordilleras y llanuras;
  // la que choca con una ya puesta no se escribe (al acercar, caben más)
  type Label = { key: string; x: number; y: number; text: string; size: number; city?: boolean; big?: boolean; region?: boolean; sea?: boolean; show: boolean; open: () => void }
  const labels: Label[] = []
  const placed: [number, number, number, number][] = []
  const fits = (x0: number, y0: number, x1: number, y1: number) => {
    if (placed.some(([a, b, c, d]) => x0 < c && x1 > a && y0 < d && y1 > b)) return false
    placed.push([x0, y0, x1, y1])
    return true
  }
  ;(cities.data?.items ?? []).forEach((c, i) => {
    const p = projection?.([c.lng, c.lat])
    if (!p) return
    const text = c.name.replace(/^Área urbana de /, '')
    const size = i < 3 ? 13 : 11
    const w = text.length * size * 0.56 * sw
    const show = fits(p[0] - 4 * sw, p[1] - size * sw, p[0] + 8 * sw + w, p[1] + 5 * sw)
    labels.push({ key: c.id, x: p[0], y: p[1], text, size, city: true, big: i < 3, show, open: () => onOpen(c) })
  })
  // mares y golfos: siempre, de los más importantes a los menores
  for (const [i, sh] of [...(shapes?.seas ?? [])].sort((a, b) => Number(a.props.rank ?? 9) - Number(b.props.rank ?? 9)).entries()) {
    if (!sh.name || !Number.isFinite(sh.c[0])) continue
    const size = sh.props.kind === 'ocean' || sh.props.kind === 'sea' ? 13 : 11
    const w = sh.name.length * size * 0.55 * sw
    const show = fits(sh.c[0] - w / 2, sh.c[1] - size * sw, sh.c[0] + w / 2, sh.c[1] + 3 * sw)
    labels.push({ key: `s${i}`, x: sh.c[0], y: sh.c[1], text: sh.name, size, sea: true, show, open: () => sh.id && onOpen(stub(sh, 'sea')) })
  }
  if (showLand && !focus)
    for (const [i, sh] of [...(shapes?.ranges ?? []), ...(shapes?.regions ?? [])].entries()) {
      if (!sh.name || !Number.isFinite(sh.c[0])) continue
      const region = Boolean(sh.props.kind)
      const size = region ? 10 : 12
      const w = sh.name.length * size * (region ? 0.75 : 0.55) * sw
      const show = fits(sh.c[0] - w / 2, sh.c[1] - size * sw, sh.c[0] + w / 2, sh.c[1] + 3 * sw)
      labels.push({ key: `t${i}`, x: sh.c[0], y: sh.c[1], text: sh.name, size, region, show, open: () => sh.id && onOpen(stub(sh, region ? 'plain' : 'range')) })
    }

  const pointer = (e: React.PointerEvent, name: string, value?: string) => {
    const box = svgRef.current!.getBoundingClientRect()
    setHover({ name, value, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  return (
    <section className="atlas">
      <div className="atlas-tabs" role="tablist">
        {rasterLayers.map((l) => (
          <button key={l.id} role="tab" aria-selected={l.id === layer.id} className={`fx-chip-t ${l.id === layer.id ? 'on' : ''}`} onClick={() => setLayerId(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="atlas-body">
        <div className="atlas-map" onPointerLeave={() => setHover(null)}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layer.name} de ${country.name}`}>
            <g ref={gRef}>
              <image href={geoAssetUrl(asset.path)} x={0} y={0} width={W} height={H} preserveAspectRatio="none" className={focus ? 'atlas-dim' : ''} />
              {shapes?.admin1.map((s, i) => {
                const v = regionValue(s.id)
                return (
                  <path
                    key={`a${i}`} d={s.d} className="atlas-admin"
                    style={focus ? { fill: focus.color, fillOpacity: v ? 0.15 + 0.8 * (v / Math.max(max, 1e-9)) : 0, strokeWidth: sw } : { strokeWidth: sw }}
                    onPointerMove={(e) => pointer(e, s.name, v !== undefined ? fmt(v) : undefined)}
                    onClick={() => s.id && onOpen(stub(s, 'admin1'))}
                  />
                )
              })}
              {shapes?.lakes.map((s, i) => <path key={`l${i}`} d={s.d} className="atlas-lake" style={{ strokeWidth: sw * 0.5 }} />)}
              {shapes?.rivers.map((s, i) => (
                <path key={`r${i}`} d={s.d} className="atlas-river" style={{ strokeWidth: (({ 1: 2.6, 2: 2, 3: 1.4, 4: 0.95, 5: 0.6 } as Record<number, number>)[s.props.ord as number] ?? 0.6) * sw }} />
              ))}
              {showLand && !focus && shapes?.ranges.map((s, i) => <path key={`m${i}`} d={s.d} className="atlas-range" style={{ strokeWidth: sw }} />)}
              {shapes?.country.map((s, i) => <path key={`c${i}`} d={s.d} className="atlas-outline" style={{ strokeWidth: 1.4 * sw }} />)}
              {labels.map((l) =>
                l.city ? (
                  <g key={l.key} className="atlas-city" transform={`translate(${l.x},${l.y})`} onClick={l.open}>
                    <circle r={(l.big ? 4 : 3) * sw} />
                    {l.show && <text x={6 * sw} y={4 * sw} style={{ fontSize: l.size * sw }}>{l.text}</text>}
                  </g>
                ) : l.show ? (
                  <text key={l.key} x={l.x} y={l.y} className={`atlas-label ${l.sea ? 'atlas-label-sea' : l.region ? 'atlas-label-region' : 'atlas-label-range'}`} style={{ fontSize: l.size * sw }} onClick={l.open}>
                    {l.text}
                  </text>
                ) : null,
              )}
            </g>
          </svg>
          {hover && (
            <div className="atlas-tip" style={{ left: hover.x, top: hover.y }}>
              <strong>{hover.name}</strong>
              {hover.value && <span>{hover.value}</span>}
            </div>
          )}
          {k > 1 && <button className="atlas-reset" onClick={() => svgRef.current && zoomRef.current && select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)}>Ver todo el país</button>}
        </div>

        <aside className="atlas-side">
          {relief ? (
            <>
              <div className="atlas-gradient" />
              <div className="atlas-gradient-labels">{layer.legend.map((l) => <span key={l.key}>{l.label}</span>)}</div>
              {elevMean !== undefined && (
                <dl className="atlas-stats">
                  <div><dt>Altitud media</dt><dd>{nf(elevMean)} m</dd></div>
                  {top?.value != null && (
                    <div>
                      <dt>Punto más alto</dt>
                      <dd>{nf(Math.round(top.value))} m</dd>
                      <button className="atlas-top" onClick={() => onOpen(top)}>{top.name} →</button>
                    </div>
                  )}
                </dl>
              )}
              <button className={`atlas-item ${focus ? 'on' : ''}`} onClick={() => setFocus(focus ? null : { key: 'mean', scope: 'm', label: 'Altitud media', color: '#8d6a54' })}>
                <i style={{ background: '#8d6a54' }} />
                <span>Estados más altos</span>
              </button>
            </>
          ) : (
            <ul className="atlas-legend">
              {legend.filter((l) => (l as { kind?: string }).kind !== 'item').map((l) => {
                const on = focus?.key === l.key
                const share = shareOf.get(l.key)
                return (
                  <li key={l.key}>
                    <button className={`atlas-item ${on ? 'on' : ''}`} onClick={() => setFocus(on ? null : { key: l.key, scope: 'share', label: l.label, color: l.color })}>
                      <i style={{ background: l.color }} />
                      <span>{l.label}</span>
                      {share !== undefined && (
                        <b>
                          <em className="atlas-bar"><em style={{ width: `${Math.max(2, share * 100)}%`, background: l.color }} /></em>
                          {pct(share)}
                        </b>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {topCrops.length > 0 && (
            <div className="atlas-crops">
              <span className="eyebrow">Lo que más produce</span>
              {topCrops.map((f) => {
                const code = f.key.slice('crops:'.length)
                const on = focus?.key === code
                return (
                  <button key={code} className={`atlas-crop ${on ? 'on' : ''}`} onClick={() => setFocus(on ? null : { key: code, scope: 'tonnes', label: cropName(code), color: '#c0573a' })}>
                    <span>{cropName(code)}</span>
                    <b>{tonnes(f.value as number)}</b>
                  </button>
                )
              })}
              <p className="muted small">Toneladas al año ({layer.source_id === 'mapspam' ? 'MapSPAM' : layer.source_id}). El mapa muestra el grupo que más superficie ocupa en cada zona.</p>
            </div>
          )}

          {focus && ranked.length > 0 && (
            <div className="atlas-rank">
              <span className="eyebrow">Dónde hay más: {focus.label.toLowerCase()}</span>
              <ol>
                {ranked.slice(0, 8).map(({ r, v }) => (
                  <li key={r.id}>
                    <button onClick={() => onOpen(r)}>
                      <span>{r.name}</span>
                      <b>{focus.scope === 'm' ? `${nf(Math.round(v))} m` : fmt(v)}</b>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <p className="atlas-credit muted small">
            {meta.data.sources.find((s) => s.id === layer.source_id)?.attribution ?? ''}
          </p>
        </aside>
      </div>
    </section>
  )
}
