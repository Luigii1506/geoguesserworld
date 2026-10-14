// Geometría mínima sin dependencias: cajas, punto en polígono con índice de
// rejilla (miles de polígonos × cientos de miles de puntos) y centroides.

/** [oeste, sur, este, norte] de una geometría GeoJSON. */
export function bboxOf(geometry) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  eachCoord(geometry, ([x, y]) => {
    if (x < w) w = x
    if (x > e) e = x
    if (y < s) s = y
    if (y > n) n = y
  })
  return [w, s, e, n]
}

export function eachCoord(g, fn) {
  if (!g) return
  if (g.type === 'GeometryCollection') return g.geometries.forEach((x) => eachCoord(x, fn))
  const walk = (c) => (typeof c[0] === 'number' ? fn(c) : c.forEach(walk))
  walk(g.coordinates)
}

/** Polígonos de una geometría como lista de anillos [exterior, ...huecos] (también dentro de colecciones). */
const polygonsOf = (g) =>
  !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : g.type === 'GeometryCollection' ? g.geometries.flatMap(polygonsOf) : []

function inRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function inGeometry(x, y, g) {
  for (const rings of polygonsOf(g)) {
    if (!inRing(x, y, rings[0])) continue
    let hole = false
    for (let k = 1; k < rings.length && !hole; k++) hole = inRing(x, y, rings[k])
    if (!hole) return true
  }
  return false
}

/**
 * Índice espacial de polígonos: lookup(lng, lat) → los items que contienen el punto.
 * @param {{ geometry: object }[]} items
 */
export function polygonIndex(items, cell = 1) {
  const grid = new Map()
  for (const it of items) {
    if (!it.geometry) continue
    const [w, s, e, n] = (it.bbox ??= bboxOf(it.geometry))
    for (let x = Math.floor(w / cell); x <= Math.floor(e / cell); x++)
      for (let y = Math.floor(s / cell); y <= Math.floor(n / cell); y++) {
        const k = `${x}|${y}`
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k).push(it)
      }
  }
  return {
    /** todos los que contienen el punto */
    lookup(lng, lat) {
      const cands = grid.get(`${Math.floor(lng / cell)}|${Math.floor(lat / cell)}`) ?? []
      return cands.filter((it) => {
        const [w, s, e, n] = it.bbox
        return lng >= w && lng <= e && lat >= s && lat <= n && inGeometry(lng, lat, it.geometry)
      })
    },
    /** el primero que lo contiene o, si ninguno (costa, islotes), el más cercano a menos de `maxKm` */
    find(lng, lat, { maxKm = 0, filter } = {}) {
      const hit = this.lookup(lng, lat).filter((it) => !filter || filter(it))
      if (hit.length || !maxKm) return hit[0] ?? null
      const r = Math.ceil(maxKm / 111 / cell) + 1
      let best = null
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++)
          for (const it of grid.get(`${Math.floor(lng / cell) + dx}|${Math.floor(lat / cell) + dy}`) ?? []) {
            if (filter && !filter(it)) continue
            const d = distanceToGeometryKm(lng, lat, it.geometry)
            if (d <= maxKm && (!best || d < best.d)) best = { it, d }
          }
      return best?.it ?? null
    },
  }
}

export function km(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180
  const d = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(d))
}

function distanceToGeometryKm(lng, lat, g) {
  let best = Infinity
  eachCoord(g, ([x, y]) => {
    const d = km(lat, lng, y, x)
    if (d < best) best = d
  })
  return best
}

/** Área aproximada en km² (proyección equivalente local por anillo). */
export function areaKm2(g) {
  let total = 0
  for (const rings of polygonsOf(g)) rings.forEach((ring, i) => (total += (i === 0 ? 1 : -1) * ringArea(ring)))
  return Math.abs(total)
}
function ringArea(ring) {
  const R = 6371.0088
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    a += ((x2 - x1) * Math.PI) / 180 * (2 + Math.sin((y1 * Math.PI) / 180) + Math.sin((y2 * Math.PI) / 180))
  }
  return Math.abs((a * R * R) / 2)
}

/** Punto representativo: centro de la caja del polígono más grande (rápido y suficiente). */
export function labelPoint(g) {
  let best = null
  for (const rings of polygonsOf(g)) {
    const a = ringArea(rings[0])
    if (!best || a > best.a) best = { a, rings }
  }
  if (!best) {
    // sin polígonos (líneas o puntos): centro de su caja
    const [w, s, e, n] = bboxOf(g)
    return Number.isFinite(w) ? [(w + e) / 2, (s + n) / 2] : null
  }
  const [w, s, e, n] = bboxOf({ type: 'Polygon', coordinates: best.rings })
  return [(w + e) / 2, (s + n) / 2]
}

/**
 * Orienta los anillos como espera d3-geo (exterior en sentido horario, huecos al
 * revés). Con la orientación de RFC 7946 d3 pintaría "todo el mundo menos el polígono".
 */
export function rewindForD3(g) {
  if (!g) return g
  const area = (ring) => {
    let a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1])
    return a // > 0: horario
  }
  const fix = (rings) => rings.map((r, i) => ((i === 0 ? area(r) < 0 : area(r) > 0) ? [...r].reverse() : r))
  if (g.type === 'Polygon') return { ...g, coordinates: fix(g.coordinates) }
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(fix) }
  if (g.type === 'GeometryCollection') return { ...g, geometries: g.geometries.map(rewindForD3) }
  return g
}
