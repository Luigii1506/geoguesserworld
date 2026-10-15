import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'

// Mapa para ubicar un lugar: se abre encuadrado en su país (si se sabe), se puede acercar y
// mover, y un clic (o toque) marca dónde crees que está. Al confirmar se ven los dos puntos.

const W = 1000
const H = 560
const projection = geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' })
const path = geoPath(projection)
const sphere = path({ type: 'Sphere' }) ?? ''

type Props = {
  /** código numérico ISO del país para encuadrarlo (el de CountryRow.ccn3) */
  focusCcn3?: string | null
  guess: [number, number] | null
  onGuess: (lngLat: [number, number]) => void
  /** tras confirmar: el punto real (y se bloquea el mapa) */
  answer?: [number, number] | null
}

export default function LocateMap({ focusCcn3, guess, onGuess, answer }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>()
  const [t, setT] = useState<ZoomTransform>(zoomIdentity)
  const [topo, setTopo] = useState<Topology | null>(null)

  // al ubicar dentro de un país hace falta detalle: el mapa a 50 m
  useEffect(() => {
    import('world-atlas/countries-50m.json').then((m) => setTopo(m.default as unknown as Topology))
  }, [])

  const shapes = useMemo(() => {
    if (!topo) return []
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>
    return fc.features.map((f: Feature<Geometry>) => ({ id: String(Number(f.id)), f, d: path(f) ?? '' })).filter((s) => s.d)
  }, [topo])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 60])
      .translateExtent([[0, 0], [W, H]])
      // un clic no es un arrastre: así marcar no mueve el mapa
      .clickDistance(6)
      .on('zoom', (e) => {
        gRef.current?.setAttribute('transform', e.transform.toString())
        setT(e.transform)
      })
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    return () => void select(svg).on('.zoom', null)
  }, [])

  // encuadre del país (o del mundo) al abrir
  const focused = useRef(false)
  useEffect(() => {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z || !shapes.length || focused.current) return
    focused.current = true
    const shape = focusCcn3 ? shapes.find((s) => s.id === String(Number(focusCcn3))) : undefined
    if (!shape) return
    const [[x0, y0], [x1, y1]] = path.bounds(shape.f)
    const k = Math.min(40, 0.8 / Math.max((x1 - x0) / W, (y1 - y0) / H))
    const tr = zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    select(svg).call(z.transform, tr)
  }, [shapes, focusCcn3])

  // tras responder, se encuadran los dos puntos
  useEffect(() => {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!answer || !guess || !svg || !z) return
    const a = projection(answer)
    const b = projection(guess)
    if (!a || !b) return
    const w = Math.max(Math.abs(a[0] - b[0]), 8)
    const h = Math.max(Math.abs(a[1] - b[1]), 8)
    const k = Math.max(1, Math.min(40, 0.6 / Math.max(w / W, h / H), t.k))
    const tr = zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2)
    select(svg).transition().duration(600).call(z.transform, tr)
  }, [answer]) // eslint-disable-line react-hooks/exhaustive-deps

  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    if (answer) return
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const y = ((e.clientY - r.top) / r.height) * H
    const [px, py] = t.invert([x, y])
    const ll = projection.invert?.([px, py])
    if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) onGuess([ll[0], ll[1]])
  }

  const zoomBy = (f: number) => {
    const svg = svgRef.current
    const z = zoomRef.current
    if (svg && z) select(svg).transition().duration(250).call(z.scaleBy, f)
  }

  const g = guess ? projection(guess) : null
  const a = answer ? projection(answer) : null
  const r = 5 / t.k
  const focusId = focusCcn3 ? String(Number(focusCcn3)) : null

  return (
    <div className="locate">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={`locate-svg ${answer ? 'done' : ''}`} onClick={click} role="img" aria-label="Mapa: toca donde crees que está">
        <path d={sphere} className="locate-sea" />
        <g ref={gRef}>
          {shapes.map((s) => <path key={s.id} d={s.d} className={`locate-land ${s.id === focusId ? 'focus' : ''}`} style={{ strokeWidth: 0.6 / t.k }} />)}
          {a && g && <line x1={a[0]} y1={a[1]} x2={g[0]} y2={g[1]} className="locate-line" style={{ strokeWidth: 1.6 / t.k, strokeDasharray: `${4 / t.k} ${3 / t.k}` }} />}
          {g && <circle cx={g[0]} cy={g[1]} r={r} className="locate-guess" style={{ strokeWidth: 1.6 / t.k }} />}
          {a && <circle cx={a[0]} cy={a[1]} r={r * 1.15} className="locate-answer" style={{ strokeWidth: 1.6 / t.k }} />}
        </g>
      </svg>
      <div className="locate-zoom">
        <button type="button" className="btn btn-quiet" onClick={() => zoomBy(1.8)} aria-label="Acercar">+</button>
        <button type="button" className="btn btn-quiet" onClick={() => zoomBy(1 / 1.8)} aria-label="Alejar">−</button>
      </div>
    </div>
  )
}
