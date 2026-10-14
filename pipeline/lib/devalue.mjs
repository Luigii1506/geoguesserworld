// Decodificador mínimo del formato "devalue" que usan los endpoints
// __data.json de SvelteKit: un array plano donde objetos y arrays
// referencian a otras posiciones por índice. Solo maneja los tipos que
// aparecen en datos JSON (no ejecuta nada).

const UNDEFINED = -1
const HOLE = -2
const NAN = -3
const POS_INF = -4
const NEG_INF = -5
const NEG_ZERO = -6

export function unflatten(values) {
  if (typeof values === 'number') return special(values)
  const hydrated = new Array(values.length)

  function special(i) {
    switch (i) {
      case UNDEFINED: case HOLE: return undefined
      case NAN: return NaN
      case POS_INF: return Infinity
      case NEG_INF: return -Infinity
      case NEG_ZERO: return -0
      default: return undefined
    }
  }

  function hydrate(index) {
    if (index < 0) return special(index)
    if (index in hydrated) return hydrated[index]
    const value = values[index]
    if (value === null || typeof value !== 'object') {
      hydrated[index] = value
    } else if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        // tipo especial: ["Date", iso] · ["Set", ...idx] · ["Map", k, v, ...] ·
        // ["BigInt", "n"] · ["RegExp", src, flags] · ["Object", idx] · ["null", k, v, ...]
        const [type, ...rest] = value
        if (type === 'Set') {
          const arr = []
          hydrated[index] = arr
          for (const i of rest) arr.push(hydrate(i))
        } else if (type === 'Map' || type === 'null') {
          const obj = {}
          hydrated[index] = obj
          for (let i = 0; i < rest.length; i += 2) {
            const k = type === 'null' ? rest[i] : hydrate(rest[i])
            obj[String(k)] = hydrate(rest[i + 1])
          }
        } else if (type === 'Object') {
          hydrated[index] = hydrate(rest[0])
        } else {
          hydrated[index] = rest[0]
        }
      } else {
        const arr = []
        hydrated[index] = arr
        for (const i of value) arr.push(hydrate(i))
      }
    } else {
      const obj = {}
      hydrated[index] = obj
      for (const key in value) obj[key] = hydrate(value[key])
    }
    return hydrated[index]
  }

  return hydrate(0)
}

/** Extrae los datos del nodo de página de una respuesta __data.json. */
export function pageData(json) {
  const nodes = json?.nodes ?? []
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]
    if (n && n.type === 'data' && Array.isArray(n.data)) return unflatten(n.data)
  }
  return null
}
