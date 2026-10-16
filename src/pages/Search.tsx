import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type CountryRow, type MapLayer, type MetaObject, useCountries, useMaps, useMetaObjects } from '../lib/data'
import { COLOR_HEX, valueLabel } from '../lib/labels'
import { imageSrc } from '../lib/images'
import { firstSentence, useGuide } from '../lib/guide'
import { hintText, useLang } from '../lib/i18n'
import { Lightbox, Loading, MissingData } from '../components/ui'
import { Img } from '../components/Img'

// Buscar: "¿dónde estoy?" a partir de lo que ves. Marcas cada pista visual
// (conducción, escritura, líneas, bolardo, poste, matrícula, señales, coche…)
// y la lista de países se reduce: los que contradicen una pista se descartan,
// los que la confirman suben, y si solo encaja una variante regional se dice
// la región (el bolardo verde → Idaho, Colorado). Cada país muestra la foto
// real del objeto que encaja, para compararla con la pantalla.

type Clue =
  | { id: string; label: string; src: 'map'; layer: string }
  | { id: string; label: string; src: 'obj'; type: string; key: string }
type Group = { id: string; label: string; clues: Clue[] }

const GROUPS: Group[] = [
  { id: 'base', label: 'Lo básico', clues: [
    { id: 'drive', label: 'Conduce por la', src: 'map', layer: 'driving' },
    { id: 'script', label: 'Escritura de las señales', src: 'map', layer: 'script' },
  ] },
  { id: 'car', label: 'Coche y cámara', clues: [
    { id: 'car_color', label: 'Color del coche', src: 'obj', type: 'google_car', key: 'car_color' },
    { id: 'car_antenna', label: 'Antena', src: 'obj', type: 'google_car', key: 'antenna' },
    { id: 'car_type', label: 'Vehículo', src: 'obj', type: 'google_car', key: 'vehicle_type' },
    { id: 'camera', label: 'Cámara', src: 'map', layer: 'camera' },
  ] },
  { id: 'road', label: 'Carretera', clues: [
    { id: 'lines', label: 'Bordes y centro', src: 'map', layer: 'lines' },
    { id: 'center_style', label: 'Línea central', src: 'obj', type: 'road_lines', key: 'center_line_style' },
    { id: 'guardrail', label: 'Guardarraíl', src: 'obj', type: 'guardrail', key: 'profile' },
  ] },
  { id: 'bollard', label: 'Bolardo', clues: [
    { id: 'b_body', label: 'Cuerpo', src: 'obj', type: 'bollard', key: 'body_color' },
    { id: 'b_mark', label: 'Marca o banda', src: 'obj', type: 'bollard', key: 'marking_color' },
    { id: 'b_pos', label: 'Dónde va la marca', src: 'obj', type: 'bollard', key: 'marking_position' },
    { id: 'b_refl', label: 'Reflector delantero', src: 'obj', type: 'bollard', key: 'front_reflector_color' },
    { id: 'b_shape', label: 'Forma', src: 'obj', type: 'bollard', key: 'shape' },
  ] },
  { id: 'pole', label: 'Poste', clues: [
    { id: 'p_mat', label: 'Material', src: 'obj', type: 'utility_pole', key: 'material' },
    { id: 'p_sec', label: 'Sección', src: 'obj', type: 'utility_pole', key: 'cross_section' },
    { id: 'p_surf', label: 'Superficie', src: 'obj', type: 'utility_pole', key: 'surface' },
  ] },
  { id: 'plate', label: 'Matrícula', clues: [
    { id: 'pl_front', label: 'Delantera', src: 'obj', type: 'licence_plate', key: 'front_color' },
    { id: 'pl_rear', label: 'Trasera', src: 'obj', type: 'licence_plate', key: 'rear_color' },
    { id: 'pl_strip', label: 'Franja lateral', src: 'obj', type: 'licence_plate', key: 'side_strip' },
    { id: 'pl_shape', label: 'Forma', src: 'obj', type: 'licence_plate', key: 'shape' },
  ] },
  { id: 'signs', label: 'Señales', clues: [
    { id: 'stop', label: 'Texto del stop', src: 'obj', type: 'stop_sign', key: 'text' },
    { id: 'chevron', label: 'Fondo del chevrón', src: 'obj', type: 'chevron', key: 'background_color' },
    { id: 'warn_shape', label: 'Advertencia: forma', src: 'obj', type: 'warning_sign', key: 'shape' },
    { id: 'warn_bg', label: 'Advertencia: fondo', src: 'obj', type: 'warning_sign', key: 'background_color' },
    { id: 'sign_back', label: 'Parte trasera', src: 'obj', type: 'sign_back', key: 'back_color' },
  ] },
  { id: 'env', label: 'Entorno', clues: [{ id: 'snow', label: 'Nieve', src: 'map', layer: 'snow' }] },
]
const CLUES = GROUPS.flatMap((g) => g.clues)
const TYPE_LABEL: Record<string, string> = {
  google_car: 'coche', road_lines: 'líneas', guardrail: 'guardarraíl', bollard: 'bolardo', utility_pole: 'poste',
  licence_plate: 'matrícula', stop_sign: 'stop', chevron: 'chevrón', warning_sign: 'advertencia', sign_back: 'trasera',
}
// enfoque de la guía que abre cada tipo de objeto
const TYPE_FOCUS: Record<string, string> = {
  bollard: 'bolardos', utility_pole: 'postes', licence_plate: 'matriculas', road_lines: 'carretera', guardrail: 'carretera',
  google_car: 'coche', stop_sign: 'senales', chevron: 'senales', warning_sign: 'senales', sign_back: 'senales',
}
const SKIP = new Set(['other', 'unknown'])

// ── modo por fotos ──
// objetos que se eligen por foto, con los rasgos que deciden si dos diseños "se parecen"
// y el rasgo del toque rápido para reducir el muro
// `ease`: lo fácil que es verlo en una imagen (pesa al proponer qué mirar después)
const VTYPES: { type: string; label: string; keys: string[]; quick: string; ease?: number }[] = [
  { type: 'bollard', label: 'Bolardo', keys: ['body_color', 'marking_color', 'front_reflector_color'], quick: 'body_color' },
  { type: 'licence_plate', label: 'Matrícula', keys: ['rear_color', 'front_color', 'side_strip'], quick: 'rear_color' },
  { type: 'utility_pole', label: 'Poste', keys: ['material', 'cross_section'], quick: 'material' },
  { type: 'road_lines', label: 'Líneas', keys: ['center_line_color', 'outer_line_color', 'center_line_style'], quick: 'center_line_color' },
  { type: 'chevron', label: 'Chevrón', keys: ['background_color', 'arrow_color'], quick: 'background_color' },
  { type: 'warning_sign', label: 'Advertencia', keys: ['background_color', 'shape', 'border_color'], quick: 'background_color' },
  { type: 'stop_sign', label: 'Stop', keys: ['text', 'shape'], quick: 'text', ease: 0.7 },
  { type: 'sign_back', label: 'Trasera de señal', keys: ['back_color', 'frame'], quick: 'back_color', ease: 0.7 },
  { type: 'guardrail', label: 'Guardarraíl', keys: ['profile'], quick: 'profile', ease: 0.6 },
  // muchas fotos del coche son mapas o esquemas: se propone al final
  { type: 'google_car', label: 'Coche de Google', keys: ['car_color', 'vehicle_type', 'antenna'], quick: 'car_color', ease: 0.4 },
]
const VTYPE = new Map(VTYPES.map((v) => [v.type, v]))
// en la búsqueda inversa ("creo que estoy en Rusia"), qué pistas de la guía corresponden a cada objeto
const TYPE_TOPIC: Record<string, { cat: string; sub?: string }> = {
  bollard: { cat: 'bollards' }, licence_plate: { cat: 'plates' }, utility_pole: { cat: 'poles' }, road_lines: { cat: 'road_lines' },
  chevron: { cat: 'signs', sub: 'chevrons' }, warning_sign: { cat: 'signs', sub: 'warning' }, stop_sign: { cat: 'signs', sub: 'stop' },
  sign_back: { cat: 'signs', sub: 'back_of_signs' }, guardrail: { cat: 'guardrails' }, google_car: { cat: 'google_car' },
}

/** Búsqueda inversa: todas las fotos de un país para el objeto elegido, de todas las fuentes. */
function CountryWall({ code, type, onType }: { code: string; type: string; onType: (t: string) => void }) {
  const g = useGuide(code)
  const lang = useLang()
  const [box, setBox] = useState<{ images: string[]; caption: string } | null>(null)
  const [more, setMore] = useState(false)
  if (g.loading) return <Loading what="las fotos" />
  if (!g.country) return null
  const name = g.country.name_es ?? g.country.name
  const tilesOf = (t: string) => {
    const tp = TYPE_TOPIC[t]
    return g.all
      .filter((c) => c.category === tp.cat && (!tp.sub || c.subcategory === tp.sub) && g.imagesOf(c).length)
      .sort((a, b) => (a.region ? 1 : 0) - (b.region ? 1 : 0) || (b.usefulness ?? 2) - (a.usefulness ?? 2))
  }
  const list = tilesOf(type)
  const vt = VTYPE.get(type)!
  return (
    <section className="sx-visual">
      <div className="sx-types">
        {VTYPES.map((t) => {
          const l = tilesOf(t.type)
          if (!l.length) return null
          return (
            <button key={t.type} className={`sx-type ${type === t.type ? 'on' : ''}`} onClick={() => { onType(t.type); setMore(false) }}>
              <img src={imageSrc(g.imagesOf(l[0])[0], 'thumb')} alt="" loading="lazy" />
              <span>{t.label} · {l.length}</span>
            </button>
          )
        })}
      </div>
      <div className="sx-wall-head">
        <strong>{vt.label === 'Coche de Google' ? 'Coche de Google' : `${vt.label}s`} de {name}</strong>
        <span className="muted small">{list.length} pistas con foto</span>
        <Link className="sx-go" to={`/pais/${code}?ver=${TYPE_FOCUS[type] ?? ''}`}>Ver en la guía →</Link>
      </div>
      {list.length ? (
        <div className="sx-wall">
          {list.slice(0, more ? undefined : WALL).map((c) => {
            const imgs = g.imagesOf(c)
            const text = firstSentence(hintText(g.hints.get(c.canonical_id)!, lang), 320)
            return (
              <button key={c.id} className="sx-tile" onClick={() => setBox({ images: imgs, caption: `${c.region ? `${c.region} · ` : ''}${text}` })}>
                <Img src={imgs[0]} />
                <span className="sx-tile-cap">{c.region ?? 'Todo el país'}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="muted">No hay fotos de este objeto para {name}.</p>
      )}
      {!more && list.length > WALL && <button className="btn more" onClick={() => setMore(true)}>Ver las {list.length - WALL} restantes</button>}
      {box && <Lightbox images={box.images} index={0} onClose={() => setBox(null)} caption={<span className="fx-lb-caption">{box.caption}</span>} />}
    </section>
  )
}
const WALL = 48 // fotos del muro antes de "ver más"
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Eval = { status: 'match' | 'regional' | 'variant' | 'contra' | 'unknown'; regions?: string[]; img?: string | null; type?: string; note?: string }
type Result = {
  c: CountryRow; score: number; matched: number; unknown: number; contra: number
  regions: string[]; notes: string[]; imgs: { img: string; label: string }[]; focus?: string
}
const VARIANT_NOTE: Record<string, string> = { special: 'variante especial', old: 'modelo antiguo', regional: 'variante regional' }

export default function Search() {
  const countries = useCountries()
  const maps = useMaps()
  const objectsFile = useMetaObjects()
  const [params, setParams] = useSearchParams()
  const [group, setGroup] = useState(GROUPS[0].id)
  const [tolerant, setTolerant] = useState(false)
  const [box, setBox] = useState<{ images: string[]; caption: string } | null>(null)
  const mode = params.get('modo') === 'rasgos' ? 'rasgos' : 'fotos'
  const guess = params.get('pais') ?? ''
  const [guessText, setGuessText] = useState('')
  const [wallType, setWallType] = useState(VTYPES[0].type)
  const [quick, setQuick] = useState<string | null>(null)
  const [wallMore, setWallMore] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  // pistas marcadas en la URL: ?p=drive:left,b_body:white
  const picked = useMemo(() => {
    const m = new Map<string, string>()
    for (const part of (params.get('p') ?? '').split(',')) {
      const [k, v] = part.split(':')
      if (k && v) m.set(k, v)
    }
    return m
  }, [params])
  const writeParams = (next: { p?: Map<string, string>; f?: number[]; modo?: string; pais?: string }) => {
    const p = [...(next.p ?? picked)].map(([k, v]) => `${k}:${v}`).join(',')
    const fv = (next.f ?? visualIds).join(',')
    const modo = next.modo ?? mode
    const pais = next.pais ?? guess
    setParams({ ...(p ? { p } : {}), ...(fv ? { f: fv } : {}), ...(modo === 'rasgos' ? { modo } : {}), ...(pais ? { pais } : {}) }, { replace: true })
  }
  const setPicked = (next: Map<string, string>) => writeParams({ p: next })
  const toggle = (clue: string, value: string) => {
    const next = new Map(picked)
    if (next.get(clue) === value) next.delete(clue)
    else next.set(clue, value)
    setPicked(next)
  }

  // fotos elegidas: ?f=<id objeto>,<id objeto>
  const visualIds = useMemo(() => (params.get('f') ?? '').split(',').map(Number).filter(Boolean), [params])
  const objById = useMemo(() => new Map((objectsFile?.objects ?? []).map((o) => [o.id, o])), [objectsFile])
  const visual = useMemo(() => visualIds.map((id) => objById.get(id)).filter((o): o is MetaObject => Boolean(o)), [visualIds, objById])
  const layers = useMemo(() => new Map((maps?.layers ?? []).map((l) => [l.id, l])), [maps])
  const byCountryType = useMemo(() => {
    const m = new Map<string, MetaObject[]>()
    for (const o of objectsFile?.objects ?? []) {
      const k = `${o.country}|${o.type}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(o)
    }
    return m
  }, [objectsFile])
  const pool = useMemo(() => (countries ?? []).filter((c) => c.groups > 0), [countries])

  /** ¿Cómo encaja este país con una pista? */
  const evaluate = (cc: string, clue: Clue, value: string): Eval => {
    if (clue.src === 'map') {
      const vals = layers.get(clue.layer)?.data[cc]
      if (!vals?.length) return { status: 'unknown' }
      return { status: vals.includes(value) ? 'match' : 'contra' }
    }
    const objs = byCountryType.get(`${cc}|${clue.type}`) ?? []
    // de todo el país = la variante principal sin región; el resto (regional, especial, antigua) pesa menos
    const national = objs.filter((o) => o.variant === 'main' && !o.region)
    const regional = objs.filter((o) => o.region)
    const others = objs.filter((o) => o.variant !== 'main' && !o.region)
    const nat = national.find((o) => o.attrs[clue.key] === value)
    if (nat) return { status: 'match', img: nat.img, type: clue.type }
    const reg = regional.filter((o) => o.attrs[clue.key] === value)
    if (reg.length) return { status: 'regional', regions: [...new Set(reg.map((o) => o.region!))], img: reg.find((o) => o.img)?.img, type: clue.type }
    const oth = others.find((o) => o.attrs[clue.key] === value)
    if (oth) return { status: 'variant', img: oth.img, type: clue.type, note: `${TYPE_LABEL[clue.type] ?? clue.type}: ${VARIANT_NOTE[oth.variant] ?? oth.variant}` }
    if (national.some((o) => o.attrs[clue.key] && !SKIP.has(o.attrs[clue.key]))) return { status: 'contra' }
    return { status: 'unknown' }
  }

  /** ¿Tiene este país un objeto que se parezca al de la foto elegida? */
  const similar = (o: MetaObject, ref: MetaObject) => {
    if (o.id === ref.id) return true
    const keys = (VTYPE.get(ref.type)?.keys ?? []).filter((k) => ref.attrs[k] && !SKIP.has(ref.attrs[k]))
    let same = 0
    for (const k of keys) {
      const v = o.attrs[k]
      if (!v || SKIP.has(v)) continue
      if (v !== ref.attrs[k]) return false
      same++
    }
    return same > 0
  }
  const evaluateVisual = (cc: string, ref: MetaObject): Eval => {
    const objs = byCountryType.get(`${cc}|${ref.type}`) ?? []
    const hits = objs.filter((o) => similar(o, ref))
    const nat = hits.find((o) => o.variant === 'main' && !o.region)
    if (nat) return { status: 'match', img: nat.img, type: ref.type }
    const reg = hits.filter((o) => o.region)
    if (reg.length) return { status: 'regional', regions: [...new Set(reg.map((o) => o.region!))], img: reg.find((o) => o.img)?.img, type: ref.type }
    if (hits.length) return { status: 'variant', img: hits[0].img, type: ref.type, note: `${TYPE_LABEL[ref.type]}: ${VARIANT_NOTE[hits[0].variant] ?? hits[0].variant}` }
    if (objs.length) return { status: 'contra' }
    return { status: 'unknown' }
  }

  const rank = (sel: Map<string, string>, tol: boolean, vis: MetaObject[] = visual): Result[] => {
    const out: Result[] = []
    for (const c of pool) {
      let score = 0
      let matched = 0
      let unknown = 0
      let contra = 0
      const regionSets: string[][] = []
      const imgs: { img: string; label: string }[] = []
      const notes: string[] = []
      let focus: string | undefined
      const evals: Eval[] = [
        ...[...sel].flatMap(([id, v]) => {
          const clue = CLUES.find((x) => x.id === id)
          return clue ? [evaluate(c.code, clue, v)] : []
        }),
        ...vis.map((ref) => evaluateVisual(c.code, ref)),
      ]
      for (const e of evals) {
        if (e.status === 'match') (score += 3), matched++
        else if (e.status === 'regional') {
          score += 2
          matched++
          regionSets.push(e.regions!)
        } else if (e.status === 'variant') {
          score += 1
          matched++
          notes.push(e.note!)
        } else if (e.status === 'unknown') unknown++
        else contra++
        if (e.img && e.type && !imgs.some((x) => x.img === e.img)) imgs.push({ img: e.img, label: TYPE_LABEL[e.type] ?? e.type })
        if (e.type) focus = TYPE_FOCUS[e.type]
      }
      if (contra > (tol ? 1 : 0)) continue
      // región: la que comparten todas las pistas regionales; si no comparten ninguna, todas
      const inter = regionSets.length ? regionSets.reduce((a, b) => a.filter((x) => b.includes(x))) : []
      const regions = inter.length ? inter : [...new Set(regionSets.flat())]
      out.push({ c, score: score - contra * 4, matched, unknown, contra, regions, notes, imgs, focus })
    }
    return out.sort((a, b) => b.score - a.score || a.unknown - b.unknown || b.c.groups - a.c.groups)
  }

  const total = picked.size + visual.length
  const results = useMemo(() => (total ? rank(picked, tolerant) : []), [picked, visual, tolerant, pool, layers, byCountryType]) // eslint-disable-line react-hooks/exhaustive-deps

  // valores de cada pista con cuántos países quedarían al elegirlos
  const optionsOf = (clue: Clue): { v: string; label: string; color?: string; n: number }[] => {
    let values: { v: string; label?: string; color?: string }[] = []
    if (clue.src === 'map') values = (layers.get(clue.layer) as MapLayer | undefined)?.values ?? []
    else {
      const set = new Set<string>()
      for (const o of objectsFile?.objects ?? []) if (o.type === clue.type && o.attrs[clue.key] && !SKIP.has(o.attrs[clue.key])) set.add(o.attrs[clue.key])
      values = [...set].map((v) => ({ v }))
    }
    return values
      .map((x) => {
        const next = new Map(picked)
        next.set(clue.id, x.v)
        // cuántos países encajarían del todo con esta opción: lo que ayuda a decidir qué marcar
        const n = rank(next, tolerant).filter((r) => r.matched === next.size + visual.length).length
        return { v: x.v, label: cap(x.label ?? valueLabel(x.v)), color: x.color ?? COLOR_HEX[x.v], n }
      })
      .filter((x) => x.n > 0 || picked.get(clue.id) === x.v)
      .sort((a, b) => b.n - a.n)
  }

  if (countries === undefined || maps === undefined || objectsFile === undefined) return <Loading what="el buscador" />
  if (!countries || !maps || !objectsFile) return <MissingData />

  const current = GROUPS.find((g) => g.id === group)!
  const groupCount = (g: Group) => g.clues.filter((c) => picked.has(c.id)).length
  const clueLabel = (id: string, v: string) => {
    const clue = CLUES.find((c) => c.id === id)
    if (!clue) return v
    const opt = clue.src === 'map' ? layers.get(clue.layer)?.values.find((x) => x.v === v)?.label : null
    const grp = GROUPS.find((g) => g.clues.includes(clue))!
    return `${grp.id === 'base' || grp.id === 'env' ? clue.label : grp.label}: ${cap(opt ?? valueLabel(v)).toLowerCase()}`
  }
  // encajan del todo: confirman cada pista; posibles: no contradicen pero faltan datos
  const full = results.filter((r) => r.matched === total)
  const partial = results.filter((r) => r.matched < total && r.matched > 0)
  const shown = (list: Result[]) => list.slice(0, 30)

  const card = (r: Result, best: boolean) => (
    <article key={r.c.code} className={`sx-card ${best ? 'best' : ''}`}>
      <div className="sx-card-head">
        <span className="flag">{r.c.flag}</span>
        <div>
          <strong>{r.c.name_es ?? r.c.name}</strong>
          <span className="sx-fit">
            {r.matched} de {total} pistas{r.unknown ? ` · ${r.unknown} sin datos` : ''}{r.contra ? ' · 1 no encaja' : ''}
          </span>
        </div>
        <span className="sx-meter"><span style={{ width: `${(r.matched / total) * 100}%` }} /></span>
      </div>
      {r.regions.length > 0 && (
        <p className="sx-region">Probablemente en <strong>{r.regions.slice(0, 4).join(', ')}</strong>{r.regions.length > 4 ? ` y ${r.regions.length - 4} más` : ''}</p>
      )}
      {r.notes.length > 0 && <p className="sx-note">Solo en {r.notes.join(' · ')}</p>}
      {r.imgs.length > 0 && (
        <div className="sx-imgs">
          {r.imgs.slice(0, 3).map((x) => (
            <button key={x.img} className="sx-img" onClick={() => setBox({ images: r.imgs.map((y) => y.img), caption: `${r.c.flag} ${r.c.name_es ?? r.c.name}` })}>
              <Img src={x.img} />
              <span>{x.label}</span>
            </button>
          ))}
        </div>
      )}
      <Link
        className="sx-go"
        to={`/pais/${r.c.code}?${new URLSearchParams({ ...(r.focus ? { ver: r.focus } : {}), ...(r.regions.length === 1 ? { region: r.regions[0] } : {}) })}`}
      >
        Ver en la guía de {r.c.name_es ?? r.c.name} →
      </Link>
    </article>
  )

  // ── muro de fotos ──
  const ranked = [...full, ...partial]
  const candidates = total ? new Set(ranked.map((r) => r.c.code)) : null
  const order = new Map(ranked.map((r, i) => [r.c.code, i]))
  const vt = VTYPE.get(wallType)!
  const isNational = (o: MetaObject) => o.variant === 'main' && !o.region
  const wallAll = objectsFile.objects
    .filter((o) => o.type === wallType && o.img && (!candidates || candidates.has(o.country)))
    .sort((a, b) => (order.get(a.country) ?? 999) - (order.get(b.country) ?? 999) || (isNational(a) ? 0 : 1) - (isNational(b) ? 0 : 1))
  const quickVals = new Map<string, number>()
  for (const o of wallAll) {
    const v = o.attrs[vt.quick]
    if (v && !SKIP.has(v)) quickVals.set(v, (quickVals.get(v) ?? 0) + 1)
  }
  const wall = quick ? wallAll.filter((o) => o.attrs[vt.quick] === quick) : wallAll
  const photosOf = (type: string) => objectsFile.objects.filter((o) => o.type === type && o.img && (!candidates || candidates.has(o.country)))
  const chosen = (type: string) => visual.find((o) => o.type === type)

  /** Elegir una foto: queda como pista y se propone el objeto que mejor separa a los que quedan. */
  const pickPhoto = (o: MetaObject) => {
    const rest = visual.filter((x) => x.type !== o.type)
    const nextVis = chosen(o.type)?.id === o.id ? rest : [...rest, o]
    writeParams({ f: nextVis.map((x) => x.id) })
    setQuick(null)
    setWallMore(false)
    if (nextVis.length === rest.length) return
    const need = picked.size + nextVis.length
    const left = new Set(rank(picked, tolerant, nextVis).filter((r) => r.matched === need).map((r) => r.c.code))
    let best: { type: string; label: string; n: number } | null = null
    for (const t of VTYPES) {
      if (nextVis.some((x) => x.type === t.type)) continue
      const sigs = new Set(
        objectsFile.objects
          .filter((x) => x.type === t.type && x.img && left.has(x.country))
          .map((x) => t.keys.map((k) => x.attrs[k] ?? '').join('|')),
      )
      const score = sigs.size * (t.ease ?? 1)
      if (sigs.size >= 2 && (!best || score > best.n)) best = { type: t.type, label: t.label, n: score }
    }
    if (best && left.size > 1) {
      setWallType(best.type)
      setHint(`${left.size} países encajan. Ahora busca: ${best.label.toLowerCase()}.`)
    } else setHint(left.size === 1 ? 'Solo queda un país.' : null)
  }

  return (
    <div className="sx">
      <header className="sx-head">
        <span className="eyebrow">Buscar</span>
        <h1>¿Dónde estoy?</h1>
        <p className="lead">
          {mode === 'fotos'
            ? 'Elige lo que ves y toca la foto que se parece. Cada foto descarta países; si algo solo existe en una región, te la diremos.'
            : 'Marca cómo es lo que ves. Cada pista descarta países; si algo solo existe en una región, te la diremos.'}
        </p>
        <form
          className="sx-guess"
          onSubmit={(e) => {
            e.preventDefault()
            const t = guessText.trim().toLowerCase()
            const hit = countries.find((c) => (c.name_es ?? '').toLowerCase() === t || c.name.toLowerCase() === t)
              ?? countries.find((c) => c.groups > 0 && ((c.name_es ?? '').toLowerCase().startsWith(t) || c.name.toLowerCase().startsWith(t)))
            if (hit) { writeParams({ pais: hit.code }); setGuessText('') }
          }}
        >
          <input className="input" list="sx-countries" placeholder="¿Sospechas un país? Rusia, Kenia…" value={guessText} onChange={(e) => setGuessText(e.target.value)} />
          <datalist id="sx-countries">
            {countries.filter((c) => c.groups > 0).map((c) => <option key={c.code} value={c.name_es ?? c.name} />)}
          </datalist>
          <button className="btn" type="submit">Ver</button>
        </form>
        <div className="seg sx-mode">
          <button className={mode === 'fotos' ? 'on' : ''} onClick={() => writeParams({ modo: 'fotos' })}>Por fotos</button>
          <button className={mode === 'rasgos' ? 'on' : ''} onClick={() => writeParams({ modo: 'rasgos' })}>Por rasgos</button>
        </div>
      </header>

      {/* pistas marcadas + resumen, siempre a la vista */}
      {!guess && <div className={`sx-bar ${total === 0 ? 'empty' : ''}`}>
        <div className="sx-picked">
          {total === 0 ? (
            <span className="muted">{mode === 'fotos' ? 'Aún no has elegido nada. Empieza por lo que más se vea: un bolardo, un poste, la matrícula…' : 'Aún no has marcado nada. Empieza por lo básico: el lado de conducción.'}</span>
          ) : (
            <>
              {visual.map((o) => (
                <button key={o.id} className="sx-thumb" onClick={() => pickPhoto(o)} aria-label={`Quitar ${TYPE_LABEL[o.type]}`}>
                  <Img src={o.img!} loading="eager" />
                  <span>{VTYPE.get(o.type)?.label} ×</span>
                </button>
              ))}
              {[...picked].map(([k, v]) => (
                <button key={k} className="fx-chip" onClick={() => toggle(k, v)}>{clueLabel(k, v)} <span>×</span></button>
              ))}
              <button className="link" onClick={() => { writeParams({ p: new Map(), f: [] }); setHint(null) }}>Empezar de nuevo</button>
            </>
          )}
        </div>
        {total > 0 && (
          <a className="sx-count" href="#/buscar" onClick={(e) => { e.preventDefault(); document.getElementById('sx-results')?.scrollIntoView({ behavior: 'smooth' }) }}>
            <strong>{full.length}</strong> {full.length === 1 ? 'país encaja' : 'países encajan'}
            {partial.length > 0 && <em>+{partial.length} posibles</em>}
            <span className="sx-flags">{(full.length ? full : partial).slice(0, 8).map((r) => <span key={r.c.code}>{r.c.flag}</span>)}</span>
          </a>
        )}
      </div>}

      {guess && countries.find((c) => c.code === guess) ? (
        <div className="sx-guessing">
          <div className="sx-guess-bar">
            <span className="flag">{countries.find((c) => c.code === guess)!.flag}</span>
            <strong>Creo que es {countries.find((c) => c.code === guess)!.name_es}</strong>
            <Link className="btn btn-quiet" to={`/pais/${guess}`}>Toda la guía</Link>
            <Link className="btn btn-quiet" to={`/duelo?a=${guess}&b=${countries.find((c) => c.code === guess)!.confusable?.[0] ?? ''}`}>Duelo con su gemelo</Link>
            <button className="link" onClick={() => writeParams({ pais: '' })}>Quitar</button>
          </div>
          <CountryWall code={guess} type={wallType} onType={setWallType} />
        </div>
      ) : (
      <div className="sx-body">
        {mode === 'fotos' ? (
          <section className="sx-visual">
            <div className="sx-types">
              {VTYPES.map((t) => {
                const photos = photosOf(t.type)
                if (!photos.length) return null
                const sel = chosen(t.type)
                return (
                  <button key={t.type} className={`sx-type ${wallType === t.type ? 'on' : ''} ${sel ? 'done' : ''}`} onClick={() => { setWallType(t.type); setQuick(null); setWallMore(false) }}>
                    <img src={imageSrc((sel ?? photos[0]).img!, 'thumb')} alt="" loading="lazy" />
                    <span>{t.label}{sel ? ' ✓' : ''}</span>
                  </button>
                )
              })}
            </div>
            {hint && <p className="sx-hint">{hint}</p>}
            <div className="sx-wall-head">
              <strong>¿Cuál se parece a tu {vt.label.toLowerCase()}?</strong>
              <span className="muted small">{wall.length} fotos{candidates ? ` de ${candidates.size} países que quedan` : ''}</span>
            </div>
            {quickVals.size > 1 && (
              <div className="sx-quick">
                {[...quickVals.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => (
                  <button key={v} className={`sx-opt ${quick === v ? 'on' : ''}`} onClick={() => { setQuick(quick === v ? null : v); setWallMore(false) }}>
                    {COLOR_HEX[v] && <span className="mp-swatch" style={{ background: COLOR_HEX[v] }} />}
                    {cap(valueLabel(v))}<span className="sx-n">{n}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="sx-wall">
              {wall.slice(0, wallMore ? undefined : WALL).map((o) => (
                <button key={o.id} className={`sx-tile ${chosen(wallType)?.id === o.id ? 'on' : ''}`} onClick={() => pickPhoto(o)}>
                  <Img src={o.img!} />
                  <span className="sx-tile-cap">
                    {[countries.find((c) => c.code === o.country)?.flag, o.region ?? (o.variant !== 'main' ? VARIANT_NOTE[o.variant] : '')].filter(Boolean).join(' ')}
                  </span>
                </button>
              ))}
            </div>
            {!wallMore && wall.length > WALL && <button className="btn more" onClick={() => setWallMore(true)}>Ver las {wall.length - WALL} fotos restantes</button>}
            <label className="check sx-tol">
              <input type="checkbox" checked={tolerant} onChange={(e) => setTolerant(e.target.checked)} /> Admitir una pista equivocada
            </label>
          </section>
        ) : (
        <section className="sx-clues">
          <div className="sx-groups">
            {GROUPS.map((g) => (
              <button key={g.id} className={`sx-group ${group === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
                {g.label}{groupCount(g) ? <span>{groupCount(g)}</span> : null}
              </button>
            ))}
          </div>
          <div className="sx-panel" key={group}>
            {current.clues.map((clue) => {
              const opts = optionsOf(clue)
              if (!opts.length) return null
              return (
                <div key={clue.id} className="sx-clue">
                  <span className="sx-clue-label">{clue.label}</span>
                  <div className="sx-opts">
                    {opts.map((o) => (
                      <button key={o.v} className={`sx-opt ${picked.get(clue.id) === o.v ? 'on' : ''}`} onClick={() => toggle(clue.id, o.v)}>
                        {o.color && <span className="mp-swatch" style={{ background: o.color }} />}
                        {o.label}
                        <span className="sx-n">{o.n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <label className="check sx-tol">
            <input type="checkbox" checked={tolerant} onChange={(e) => setTolerant(e.target.checked)} /> Admitir una pista equivocada
          </label>
        </section>
        )}

        {/* ── países que encajan ── */}
        <section className="sx-results" id="sx-results">
          {total === 0 ? (
            <div className="sx-empty">
              <p>Funciona como un detective: cada foto que eliges descarta países.</p>
              <ol>
                <li>Elige lo que ves: un bolardo, un poste, la matrícula…</li>
                <li>Toca la foto que más se parece a tu pantalla.</li>
                <li>Repite con lo siguiente que te propongamos hasta que queden pocos.</li>
              </ol>
            </div>
          ) : full.length + partial.length === 0 ? (
            <div className="sx-empty">
              <p>Ningún país encaja con todas las pistas. Quita alguna o marca «Admitir una pista equivocada».</p>
            </div>
          ) : (
            <div className="sx-list">
              {full.length > 0 && <h2 className="sx-sec">Encajan con todo</h2>}
              {shown(full).map((r, i) => card(r, i === 0))}
              {partial.length > 0 && (
                <>
                  <h2 className="sx-sec">Posibles <span>no contradicen nada, pero no tenemos datos de alguna pista</span></h2>
                  {shown(partial).map((r) => card(r, false))}
                </>
              )}
              {full.length + partial.length > 60 && <p className="muted small">Marca otra pista para afinar.</p>}
            </div>
          )}
        </section>
      </div>

      )}

      {box && <Lightbox images={box.images} index={0} onClose={() => setBox(null)} caption={<span>{box.caption}</span>} />}
    </div>
  )
}
