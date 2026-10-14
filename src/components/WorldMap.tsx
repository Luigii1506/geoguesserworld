import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import 'd3-transition'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { CountryRow } from '../lib/data'
import { REGION_ES } from '../lib/labels'

// Mapa mundial de las guías: cada país se tiñe con el acento según cuántas
// pistas tiene; al pasar el ratón muestra su ficha y al hacer clic abre la guía.
// Los países demasiado pequeños para verse (Andorra, Singapur…) van como punto.

const W = 1000
const H = 520
const SMALL_KM2 = 2600 // por debajo, el país se dibuja también como punto
const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'] as const

type Shape = { id: string; d: string; country?: CountryRow; centroid: [number, number] }

const projection = geoEqualEarth().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' })
const path = geoPath(projection)
const sphere = path({ type: 'Sphere' }) ?? ''
const graticule = path(geoGraticule10()) ?? ''


type Props = {
  countries: CountryRow[]
  /** países a resaltar (los demás se atenúan) */
  highlight?: Set<string>
  /** mapa temático: color de cada país (undefined = sin dato, rayado) */
  paint?: (c: CountryRow) => string | undefined
  /** contenido de la ficha flotante bajo el nombre (por defecto, pistas y conducción) */
  card?: (c: CountryRow) => React.ReactNode
  /** leyenda propia en lugar de la de pistas */
  legend?: React.ReactNode
  /** patrones SVG propios (p. ej. rayas de dos colores); reciben el zoom para mantener su tamaño en pantalla */
  defs?: (k: number) => React.ReactNode
}

export default function WorldMap({ countries, highlight, paint, card, legend, defs }: Props) {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>()
  const [topo, setTopo] = useState<Topology | null>(null)
  const [hover, setHover] = useState<{ c: CountryRow; x: number; y: number; flip: boolean } | null>(null)
  const [k, setK] = useState(1)
  const [region, setRegion] = useState<string>('')

  useEffect(() => {
    import('world-atlas/countries-50m.json').then((m) => setTopo(m.default as unknown as Topology))
  }, [])

  const byNum = useMemo(() => new Map(countries.filter((c) => c.ccn3).map((c) => [String(Number(c.ccn3)), c])), [countries])
  // intensidad del acento por percentil de pistas: reparte los tonos aunque muchos países tengan cifras parecidas
  const tone = useMemo(() => {
    const sorted = countries.filter((c) => c.groups > 0).map((c) => c.groups).sort((a, b) => a - b)
    return (n: number) => {
      let lo = 0
      let hi = sorted.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (sorted[mid] < n) lo = mid + 1
        else hi = mid
      }
      return 0.18 + 0.82 * (lo / Math.max(1, sorted.length - 1))
    }
  }, [countries])

  const shapes = useMemo<Shape[]>(() => {
    if (!topo) return []
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>
    return fc.features
      .map((f: Feature<Geometry, { name: string }>) => {
        const id = String(Number(f.id))
        return { id, d: path(f) ?? '', country: byNum.get(id), centroid: path.centroid(f) as [number, number] }
      })
      .filter((s) => s.d)
  }, [topo, byNum])

  // países con guía que no se ven: puntos en su coordenada
  const dots = useMemo(() => {
    const drawn = new Set(shapes.filter((s) => s.country).map((s) => s.country!.code))
    return countries
      .filter((c) => c.groups > 0 && c.lat != null && c.lng != null && (!drawn.has(c.code) || (c.area ?? Infinity) < SMALL_KM2))
      .map((c) => ({ c, p: projection([c.lng!, c.lat!]), drawn: drawn.has(c.code) }))
      .filter((d): d is { c: CountryRow; p: [number, number]; drawn: boolean } => Boolean(d.p))
  }, [countries, shapes])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', (e) => {
        gRef.current?.setAttribute('transform', e.transform.toString())
        setK(e.transform.k)
      })
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    return () => void select(svg).on('.zoom', null)
  }, [])

  /** Encuadra un continente (o el mundo) con una transición suave. */
  const focus = (r: string) => {
    setRegion(r)
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z) return
    if (!r) return void select(svg).transition().duration(750).call(z.transform, zoomIdentity)
    // sin los países enormes (Rusia, Groenlandia…), que desplazarían el encuadre
    const pts = shapes
      .filter((s) => s.country?.region === r && s.country.groups > 0 && (s.country.area ?? 0) > 20000 && (s.country.area ?? 0) < 3_000_000)
      .map((s) => s.centroid)
    if (!pts.length) return
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const scale = Math.min(8, 0.8 / Math.max((x1 - x0) / W, (y1 - y0) / H))
    const t = zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    select(svg).transition().duration(900).call(z.transform, t)
  }

  const zoomBy = (f: number) => {
    const svg = svgRef.current
    if (svg && zoomRef.current) select(svg).transition().duration(300).call(zoomRef.current.scaleBy, f)
  }

  const onMove = (e: React.MouseEvent, c: CountryRow) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (box) setHover({ c, x: e.clientX - box.left, y: e.clientY - box.top, flip: e.clientX - box.left > box.width * 0.62 })
  }
  const open = (c?: CountryRow) => c && c.groups > 0 && navigate(`/pais/${c.code}`)
  const dim = (c?: CountryRow) => Boolean(highlight && (!c || !highlight.has(c.code)))

  return (
    <div className="worldmap">
      <div className="worldmap-bar">
        <div className="seg seg-sm">
          <button className={!region ? 'on' : ''} onClick={() => focus('')}>Mundo</button>
          {REGIONS.map((r) => (
            <button key={r} className={region === r ? 'on' : ''} onClick={() => focus(r)}>{REGION_ES[r]}</button>
          ))}
        </div>
        <div className="worldmap-zoom">
          <button onClick={() => zoomBy(1.6)} aria-label="Acercar">+</button>
          <button onClick={() => zoomBy(1 / 1.6)} aria-label="Alejar">−</button>
        </div>
      </div>

      <div className="worldmap-stage" onMouseLeave={() => setHover(null)}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa de países con guía">
          <defs>
            {/* sin dato: rayado fino, para no confundirlo con ningún color de la leyenda */}
            <pattern id="wm-hatch" width={5 / k} height={5 / k} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={5 / k} height={5 / k} className="wm-hatch-bg" />
              <line x1="0" y1="0" x2="0" y2={5 / k} className="wm-hatch-line" style={{ strokeWidth: 1.4 / k }} />
            </pattern>
            {defs?.(k)}
          </defs>
          <path d={sphere} className="wm-sphere" />
          <g ref={gRef}>
            <path d={graticule} className="wm-graticule" />
            {shapes.map((s, i) => {
              const c = s.country
              const guided = c && c.groups > 0
              const fill = paint
                ? (c && paint(c)) ?? 'url(#wm-hatch)'
                : guided
                  ? `color-mix(in oklab, var(--accent) ${Math.round(tone(c.groups) * 100)}%, var(--map-land))`
                  : undefined
              return (
                <path
                  key={i}
                  d={s.d}
                  data-code={c?.code}
                  className={`wm-country ${guided ? 'guided' : ''} ${paint ? 'painted' : ''} ${hover?.c === c && c ? 'hover' : ''} ${dim(c) ? 'dim' : ''}`}
                  style={fill ? { fill } : undefined}
                  onMouseMove={c ? (e) => onMove(e, c) : undefined}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => open(c)}
                />
              )
            })}
            {/* tamaño fijo en pantalla; con zoom, el punto sobra si el país ya se ve dibujado */}
            {dots.filter((d) => !d.drawn || k < 4).map(({ c, p }) => (
              <circle
                key={c.code}
                cx={p[0]}
                cy={p[1]}
                r={3.4 / k}
                className={`wm-dot ${paint ? 'painted' : ''} ${hover?.c === c ? 'hover' : ''} ${dim(c) ? 'dim' : ''}`}
                style={paint ? { fill: paint(c) ?? 'var(--map-land)' } : undefined}
                onMouseMove={(e) => onMove(e, c)}
                onMouseLeave={() => setHover(null)}
                onClick={() => open(c)}
              />
            ))}
          </g>
        </svg>

        {hover && (
          <div
            className="wm-card"
            style={{ left: hover.x, top: hover.y, transform: `translate(${hover.flip ? 'calc(-100% - 14px)' : '14px'}, -50%)` }}
          >
            <div className="wm-card-name">
              <span className="flag">{hover.c.flag}</span>
              <strong>{hover.c.name_es ?? hover.c.name}</strong>
            </div>
            {card ? (
              card(hover.c)
            ) : hover.c.groups > 0 ? (
              <>
                <div className="wm-card-stats">
                  <span><b>{hover.c.essential}</b> esenciales</span>
                  <span><b>{hover.c.groups}</b> pistas</span>
                </div>
                <div className="wm-card-meta">
                  {hover.c.driving_side === 'left' ? 'Conduce por la izquierda' : 'Conduce por la derecha'}
                  {hover.c.languages?.length ? ` · ${hover.c.languages.slice(0, 2).join(', ')}` : ''}
                </div>
                <div className="wm-card-cta">Abrir guía →</div>
              </>
            ) : (
              <div className="wm-card-meta">Sin cobertura de Street View ni guía</div>
            )}
          </div>
        )}

        {!topo && <div className="wm-loading">Cargando mapa…</div>}
      </div>

      {legend ?? (
      <div className="worldmap-legend">
        <span>Menos pistas</span>
        <span className="wm-ramp" />
        <span>Más pistas</span>
        <span className="wm-none" />
        <span>Sin guía</span>
      </div>
      )}
    </div>
  )
}
