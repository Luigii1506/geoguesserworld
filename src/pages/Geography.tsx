import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCountryMap, useJson } from '../lib/data'
import { REGION_ES } from '../lib/labels'
import { Loading, MissingData, PLACE_KIND, PlaceMap, type Place } from '../components/ui'

// Geografía: volcanes, ríos, ciudades, monumentos y templos de los países de
// GeoGuessr (atlas de Wikidata + lugares que nombran las pistas), como fichas
// visuales para aprender. Portada con rankings; filtros por tipo, subtipo,
// continente y país; orden según el tipo (más altos, más largos, más poblados…)
// y vista de galería o de ranking. Cada ficha abre su modal.

type Facts = { ele?: number; pop?: number; len?: number; unesco?: number; area?: number; q?: number; basin?: number; prom?: number; depth?: number; vis?: number; nc?: number }
type IndexPlace = { cs?: string[]; id: string; n: string; en: string; t: string; cc: string; lat: number; lng: number; th?: string; d?: string; h: number; s?: number; f?: Facts }

const nf = (n: number) => n.toLocaleString('es')
const popText = (p: number) => (p >= 1e6 ? `${(p / 1e6).toLocaleString('es', { maximumFractionDigits: 1 })} M hab.` : `${nf(Math.round(p / 1000) * 1000)} hab.`)

/** El dato que mejor resume un lugar: altura, longitud o población. */
export function factLine(t: string, f?: Facts): string | null {
  if (!f) return null
  if (f.ele && ['volcano', 'mountain', 'range'].includes(t)) return `${nf(f.ele)} m`
  if (f.len && t === 'river') return `${nf(f.len)} km`
  if (f.pop && ['city', 'town', 'region'].includes(t)) return popText(f.pop)
  return null
}

type SortId = 'imp' | 'local' | 'ele' | 'len' | 'pop' | 'area' | 'q' | 'basin' | 'nc' | 'prom' | 'depth' | 'vis' | 'hints' | 'az'
const FAMILIES: { id: string; label: string; types: string[]; sort?: SortId }[] = [
  { id: 'ciudades', label: 'Ciudades y pueblos', types: ['city', 'town', 'village', 'neighbourhood'], sort: 'pop' },
  { id: 'montanas', label: 'Volcanes y montañas', types: ['volcano', 'mountain', 'range'], sort: 'ele' },
  { id: 'agua', label: 'Ríos, lagos y costas', types: ['river', 'lake', 'waterfall', 'coast', 'beach'], sort: 'len' },
  { id: 'islas', label: 'Islas', types: ['island', 'peninsula'] },
  { id: 'naturaleza', label: 'Naturaleza', types: ['desert', 'forest', 'national_park', 'natural'] },
  { id: 'monumentos', label: 'Monumentos', types: ['monument', 'landmark', 'bridge', 'palace', 'castle'] },
  { id: 'templos', label: 'Templos e iglesias', types: ['temple', 'church', 'mosque'] },
  { id: 'arqueologia', label: 'Arqueología', types: ['archaeological'] },
  { id: 'regiones', label: 'Regiones', types: ['region', 'area'] },
]
const FAMILY_OF = new Map(FAMILIES.flatMap((f) => f.types.map((t) => [t, f.id] as const)))
const CONTINENTS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
// en "Todo", primero lo más visual; las regiones al final
const FAMILY_RANK: Record<string, number> = { montanas: 0, monumentos: 0, templos: 0, arqueologia: 0, agua: 1, naturaleza: 1, islas: 1, ciudades: 2, regiones: 4 }
const PAGE = 36

const SORTS: { id: SortId; label: string; value?: (p: IndexPlace) => number | undefined; unit?: (v: number) => string }[] = [
  { id: 'imp', label: 'Más conocidos' },
  { id: 'local', label: 'Lo más conocido de cada país' },
  { id: 'ele', label: 'Más altos', value: (p) => p.f?.ele, unit: (v) => `${nf(v)} m` },
  { id: 'len', label: 'Más largos', value: (p) => p.f?.len, unit: (v) => `${nf(v)} km` },
  { id: 'pop', label: 'Más poblados', value: (p) => p.f?.pop, unit: popText },
  { id: 'area', label: 'Más extensos', value: (p) => p.f?.area, unit: (v) => `${nf(Math.round(v))} km²` },
  { id: 'q', label: 'Más caudal', value: (p) => p.f?.q, unit: (v) => `${nf(Math.round(v))} m³/s` },
  { id: 'basin', label: 'Mayor cuenca', value: (p) => p.f?.basin, unit: (v) => `${nf(Math.round(v))} km²` },
  { id: 'nc', label: 'Cruzan más países', value: (p) => p.f?.nc, unit: (v) => `${v} países` },
  { id: 'prom', label: 'Más prominentes', value: (p) => p.f?.prom, unit: (v) => `${nf(Math.round(v))} m` },
  { id: 'depth', label: 'Más profundos', value: (p) => p.f?.depth, unit: (v) => `${nf(Math.round(v))} m` },
  { id: 'vis', label: 'Más visitados', value: (p) => p.f?.vis, unit: (v) => `${nf(v)} visitas/año` },
  { id: 'hints', label: 'Más en las pistas', value: (p) => p.h || undefined, unit: (v) => `${v} ${v === 1 ? 'pista' : 'pistas'}` },
  { id: 'az', label: 'A–Z' },
]
const SORT = new Map(SORTS.map((s) => [s.id, s]))
// métricas que tienen sentido en cada tipo (si no hay tipo, todas las que tengan datos)
const SORTS_FOR: Record<string, SortId[]> = {
  ciudades: ['imp', 'local', 'pop', 'area', 'ele', 'hints', 'az'],
  montanas: ['imp', 'local', 'ele', 'prom', 'hints', 'az'],
  agua: ['imp', 'local', 'len', 'q', 'basin', 'nc', 'area', 'depth', 'hints', 'az'],
  islas: ['imp', 'local', 'area', 'pop', 'ele', 'hints', 'az'],
  naturaleza: ['imp', 'local', 'area', 'vis', 'hints', 'az'],
  monumentos: ['imp', 'local', 'vis', 'hints', 'az'],
  templos: ['imp', 'local', 'vis', 'hints', 'az'],
  arqueologia: ['imp', 'local', 'vis', 'area', 'hints', 'az'],
  regiones: ['imp', 'local', 'pop', 'area', 'hints', 'az'],
}
// métricas que se muestran en la ficha
const METRICS: [keyof Facts, string, (v: number) => string][] = [
  ['ele', 'Altitud', (v) => `${nf(v)} m`], ['prom', 'Prominencia', (v) => `${nf(Math.round(v))} m`],
  ['len', 'Longitud', (v) => `${nf(v)} km`], ['q', 'Caudal', (v) => `${nf(Math.round(v))} m³/s`],
  ['basin', 'Cuenca', (v) => `${nf(Math.round(v))} km²`], ['nc', 'Países', (v) => `${v}`],
  ['area', 'Superficie', (v) => `${nf(Math.round(v))} km²`], ['depth', 'Profundidad', (v) => `${nf(Math.round(v))} m`],
  ['pop', 'Población', (v) => nf(v)], ['vis', 'Visitantes al año', (v) => nf(v)],
]
// importancia = lo conocido que es: en cuántas Wikipedias tiene artículo (las pistas no cuentan)
const importance = (p: IndexPlace) => p.s ?? 0

// rankings de la portada
const RANKINGS: { title: string; types: string[]; sort: SortId; params: Record<string, string>; unesco?: boolean }[] = [
  { title: 'Los volcanes más altos', types: ['volcano'], sort: 'ele', params: { tipo: 'montanas', sub: 'volcano', orden: 'ele' } },
  { title: 'Las montañas más altas', types: ['mountain'], sort: 'ele', params: { tipo: 'montanas', sub: 'mountain', orden: 'ele' } },
  { title: 'Los ríos más largos', types: ['river'], sort: 'len', params: { tipo: 'agua', sub: 'river', orden: 'len' } },
  { title: 'Las ciudades más pobladas', types: ['city'], sort: 'pop', params: { tipo: 'ciudades', sub: 'city', orden: 'pop' } },
  { title: 'Patrimonio de la Humanidad', types: [], sort: 'imp', params: { unesco: '1', orden: 'imp' }, unesco: true },
  { title: 'Los ríos más caudalosos', types: ['river'], sort: 'q', params: { tipo: 'agua', sub: 'river', orden: 'q' } },
  { title: 'Las islas más grandes', types: ['island'], sort: 'area', params: { tipo: 'islas', sub: 'island', orden: 'area' } },
  { title: 'Los lagos más grandes', types: ['lake'], sort: 'area', params: { tipo: 'agua', sub: 'lake', orden: 'area' } },
]

type CountryOpt = { code: string; n: number; flag: string; name: string; alt: string }
const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Buscador de países: escribe "mex" y elige con el ratón, el dedo o las flechas. */
function CountryPicker({ options, value, onChange }: { options: CountryOpt[]; value: string; onChange: (cc: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const current = options.find((o) => o.code === value)
  const needle = fold(q.trim())
  const list = (needle ? options.filter((o) => fold(o.name).includes(needle) || fold(o.alt).includes(needle)) : options)
    .sort((a, b) => (needle ? (fold(a.name).startsWith(needle) ? 0 : 1) - (fold(b.name).startsWith(needle) ? 0 : 1) : 0) || a.name.localeCompare(b.name, 'es'))
    .slice(0, 60)
  const pick = (cc: string) => {
    onChange(cc)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="cp" ref={box}>
      <input
        className="input cp-input"
        placeholder={current ? `${current.flag} ${current.name}` : 'Buscar país: México, Japón…'}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, list.length - 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
          else if (e.key === 'Enter' && list[hi]) pick(list[hi].code)
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {current && !q && (
        <button className="cp-clear" onClick={() => onChange('')} aria-label="Quitar país">×</button>
      )}
      {open && (
        <ul className="cp-list" role="listbox">
          {list.length === 0 && <li className="cp-empty">Ningún país coincide</li>}
          {list.map((o, i) => (
            <li key={o.code}>
              <button className={`${i === hi ? 'hi' : ''} ${o.code === value ? 'on' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => pick(o.code)}>
                <span className="cp-flag">{o.flag}</span>
                <span className="cp-name">{o.name}</span>
                <span className="cp-n">{o.n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Geography() {
  const index = useJson<IndexPlace[]>('/community/places-index.json')
  const map = useCountryMap()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<IndexPlace | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const fam = params.get('tipo') ?? ''
  const sub = params.get('sub') ?? ''
  const cont = params.get('continente') ?? ''
  const cc = params.get('pais') ?? ''
  const unesco = params.get('unesco') === '1'
  const inHints = params.get('pistas') === '1'
  const view = params.get('vista') === 'ranking' ? 'ranking' : 'galeria'
  const family = FAMILIES.find((f) => f.id === fam)
  const sortId = (params.get('orden') as SortId) || 'imp'
  const sort = SORT.get(sortId) ?? SORT.get('imp')!

  const setMany = (changes: Record<string, string>, top = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
    setShown(PAGE)
    if (top) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const set = (k: string, v: string) =>
    setMany({ [k]: v, ...(k === 'continente' ? { pais: '' } : {}), ...(k === 'tipo' ? { sub: '', orden: '' } : {}) })

  // búsqueda con una pausa corta
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((params.get('q') ?? '') !== q.trim()) set('q', q.trim())
    }, 220)
    return () => window.clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const base = useMemo(() => (index ?? []).filter((p) => FAMILY_OF.has(p.t)), [index])
  const matches = (p: IndexPlace, skip?: string) => {
    const needle = (params.get('q') ?? '').toLowerCase()
    if (needle && !`${p.n} ${p.en} ${p.d ?? ''}`.toLowerCase().includes(needle)) return false
    if (skip !== 'tipo' && fam && FAMILY_OF.get(p.t) !== fam) return false
    if (skip !== 'sub' && sub && p.t !== sub) return false
    const ccs = p.cs ?? [p.cc]
    if (skip !== 'continente' && cont && !ccs.some((x) => map.get(x)?.region === cont)) return false
    if (skip !== 'pais' && cc && !ccs.includes(cc)) return false
    if (unesco && !p.f?.unesco) return false
    if (inHints && !p.h) return false
    return true
  }
  const compare = (a: IndexPlace, b: IndexPlace, s = sort) => {
    if (s.id === 'az') return a.n.localeCompare(b.n, 'es')
    if (s.id === 'local') {
      // puesto dentro de su país y tipo: el nº 1 de cada país primero, luego los nº 2…
      const ra = localRank.get(a.id) ?? 99
      const rb = localRank.get(b.id) ?? 99
      if (ra !== rb) return ra - rb
      return importance(b) - importance(a)
    }
    if (s.value) {
      const va = s.value(a)
      const vb = s.value(b)
      if (va !== vb) return (vb ?? -1) - (va ?? -1)
    }
    return (
      (fam || cc || s.id !== 'imp' ? 0 : (FAMILY_RANK[FAMILY_OF.get(a.t)!] ?? 3) - (FAMILY_RANK[FAMILY_OF.get(b.t)!] ?? 3)) ||
      (s.id === 'imp' ? importance(b) - importance(a) : 0) ||
      (b.th ? 1 : 0) - (a.th ? 1 : 0) ||
      importance(b) - importance(a) ||
      b.h - a.h ||
      a.n.localeCompare(b.n, 'es')
    )
  }
  const filtered = useMemo(() => base.filter((p) => matches(p)), [base, params.toString(), map]) // eslint-disable-line react-hooks/exhaustive-deps
  // puesto de cada lugar entre los de su país y su tipo (por lo conocido que es)
  const localRank = useMemo(() => {
    const groups = new Map<string, IndexPlace[]>()
    for (const p of filtered) {
      const k = `${p.cc}|${sub ? p.t : FAMILY_OF.get(p.t)}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(p)
    }
    const m = new Map<string, number>()
    for (const list of groups.values()) list.sort((a, b) => importance(b) - importance(a)).forEach((p, i) => m.set(p.id, i + 1))
    return m
  }, [filtered, sub])
  // con un orden por dato (altura, población…), los que no lo tienen van al final (no se esconden)
  const list = useMemo(
    () => [...filtered].sort((a, b) => compare(a, b)),
    [filtered, sortId, localRank], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const count = (skip: string, key: (p: IndexPlace) => string) => {
    const m = new Map<string, number>()
    for (const p of base) if (matches(p, skip)) m.set(key(p), (m.get(key(p)) ?? 0) + 1)
    return m
  }
  const famCount = useMemo(() => count('tipo', (p) => FAMILY_OF.get(p.t)!), [base, params.toString(), map]) // eslint-disable-line react-hooks/exhaustive-deps
  const subCount = useMemo(() => (family ? count('sub', (p) => p.t) : new Map<string, number>()), [base, params.toString(), map]) // eslint-disable-line react-hooks/exhaustive-deps
  const countryOptions = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of base) if (matches(p, 'pais')) for (const x of p.cs ?? [p.cc]) m.set(x, (m.get(x) ?? 0) + 1)
    return [...m.entries()].map(([code, n]) => ({ code, n, c: map.get(code) })).filter((x) => x.c).sort((a, b) => (a.c!.name_es ?? '').localeCompare(b.c!.name_es ?? '', 'es'))
  }, [base, params.toString(), map]) // eslint-disable-line react-hooks/exhaustive-deps
  // órdenes que tienen sentido: los que algún lugar de la selección puede cumplir
  const sorts = SORTS.filter((s) => (!fam || (SORTS_FOR[fam] ?? []).includes(s.id)) && (!s.value || filtered.some((p) => s.value!(p) !== undefined)))
  const withHints = useMemo(() => base.filter((p) => p.h > 0 && matches(p)).length, [base, params.toString(), map]) // eslint-disable-line react-hooks/exhaustive-deps

  // la galería se va cargando al bajar
  useEffect(() => {
    const el = sentinel.current
    if (!el || shown >= list.length) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setShown((n) => n + PAGE), { rootMargin: '900px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown, list.length])

  if (index === undefined || !map.size) return <Loading what="la geografía" />
  if (!index) return <MissingData />

  const landing = !fam && !sub && !cont && !cc && !unesco && !inHints && !params.get('q') && !params.get('orden')
  const toPlace = (p: IndexPlace): Place & { d?: string; fact?: string | null; unesco?: boolean; metrics?: [string, string][] } => ({
    id: p.id, n: p.en, es: p.n, lat: p.lat, lng: p.lng, k: p.t, cc: p.cc, d: p.d, fact: factLine(p.t, p.f), unesco: Boolean(p.f?.unesco),
    metrics: METRICS.flatMap(([k, label, unit]) => (p.f?.[k] ? [[label, unit(p.f[k]!)] as [string, string]] : [])),
  })
  const card = (p: IndexPlace, rank?: number) => {
    const c = map.get(p.cc)
    return (
      <button key={p.id} className={`geo-card ${p.th ? '' : 'noimg'}`} onClick={() => setOpen(p)}>
        <div className="geo-img">
          {p.th ? <img src={p.th} alt="" loading="lazy" /> : <span>{PLACE_KIND[p.t] ?? 'Lugar'}</span>}
          {rank ? <em className="geo-rank">{rank}</em> : <em className="geo-type">{PLACE_KIND[p.t] ?? 'Lugar'}</em>}
          {p.f?.unesco && !rank ? <em className="geo-unesco">UNESCO</em> : null}
          {factLine(p.t, p.f) && <em className="geo-fact">{factLine(p.t, p.f)}</em>}
        </div>
        <div className="geo-body">
          <strong>{p.n}</strong>
          <span className="geo-where-line">
            {p.cs ? `${p.cs.map((x) => map.get(x)?.flag ?? '').join(' ')} ${p.cs.length} países` : `${c?.flag ?? ''} ${c?.name_es ?? c?.name ?? ''}`}
          </span>
          {p.d && <span className="geo-desc">{p.d}</span>}
        </div>
      </button>
    )
  }

  const rankings = landing
    ? RANKINGS.map((r) => {
        const s = SORT.get(r.sort)!
        const items = base
          .filter((p) => (!r.types.length || r.types.includes(p.t)) && (!r.unesco || p.f?.unesco) && (!s.value || s.value(p) !== undefined))
          .sort((a, b) => compare(a, b, s))
          .slice(0, 10)
        return { ...r, items }
      }).filter((r) => r.items.length >= 3)
    : []
  const maxValue = sort.value ? Math.max(1, ...list.slice(0, 200).map((p) => sort.value!(p) ?? 0)) : 0

  return (
    <div className="geo">
      <header className="geo-hero">
        <span className="eyebrow">Geografía</span>
        <h1>Ponle cara a cada nombre</h1>
        <p className="lead">
          {nf(base.length)} volcanes, ríos, montañas, ciudades, monumentos y templos del mundo. Ordénalos por lo conocidos, altos, largos o poblados que son, y ábrelos para ver dónde están y cómo son.
        </p>
      </header>

      <div className="geo-bar">
        <input className="input geo-search" type="search" placeholder="Busca un lugar: Malinche, Danubio, Kioto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="geo-chips">
          <button className={`fx-chip-t ${!fam ? 'on' : ''}`} onClick={() => set('tipo', '')}>Todo</button>
          {FAMILIES.filter((f) => famCount.get(f.id)).map((f) => (
            <button key={f.id} className={`fx-chip-t ${fam === f.id ? 'on' : ''}`} onClick={() => set('tipo', fam === f.id ? '' : f.id)}>
              {f.label} <span>{famCount.get(f.id)}</span>
            </button>
          ))}
        </div>
        {family && subCount.size > 1 && (
          <div className="geo-chips geo-subs">
            <button className={`fx-chip-s ${!sub ? 'on' : ''}`} onClick={() => set('sub', '')}>Todos</button>
            {family.types.filter((t) => subCount.get(t)).map((t) => (
              <button key={t} className={`fx-chip-s ${sub === t ? 'on' : ''}`} onClick={() => set('sub', sub === t ? '' : t)}>
                {PLACE_KIND[t] ?? t} <span>{subCount.get(t)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="geo-where">
          <select className="input geo-cont-m" value={cont} onChange={(e) => set('continente', e.target.value)}>
            <option value="">Todo el mundo</option>
            {CONTINENTS.map((r) => <option key={r} value={r}>{REGION_ES[r]}</option>)}
          </select>
          <div className="seg seg-sm geo-cont">
            <button className={!cont ? 'on' : ''} onClick={() => set('continente', '')}>Mundo</button>
            {CONTINENTS.map((r) => (
              <button key={r} className={cont === r ? 'on' : ''} onClick={() => set('continente', cont === r ? '' : r)}>{REGION_ES[r]}</button>
            ))}
          </div>
          <CountryPicker
            value={cc}
            onChange={(v) => setMany({ pais: v, continente: v ? '' : cont })}
            options={countryOptions.map((x) => ({ code: x.code, n: x.n, flag: x.c!.flag ?? '', name: x.c!.name_es ?? x.c!.name, alt: x.c!.name }))}
          />
        </div>
      </div>

      {/* país elegido: cabecera con accesos directos a cada tipo */}
      {cc && map.get(cc) && (
        <section className="geo-country-head">
          <div className="geo-country-name">
            <span className="flag">{map.get(cc)!.flag}</span>
            <div>
              <h2>{map.get(cc)!.name_es ?? map.get(cc)!.name}</h2>
              <span className="muted small">{nf(countryOptions.find((x) => x.code === cc)?.n ?? 0)} lugares</span>
            </div>
            {map.get(cc)!.groups > 0 && <a className="link" href={`#/pais/${cc}`}>Guía de GeoGuessr →</a>}
          </div>
          <div className="geo-country-types">
            {FAMILIES.flatMap((f) => f.types).map((t) => {
              const n = base.filter((p) => p.t === t && (p.cs ?? [p.cc]).includes(cc)).length
              if (!n) return null
              const on = sub === t
              return (
                <button key={t} className={`geo-ctype ${on ? 'on' : ''}`} onClick={() => setMany(on ? { tipo: '', sub: '' } : { tipo: FAMILY_OF.get(t)!, sub: t })}>
                  <strong>{n}</strong>
                  <span>{PLACE_KIND[t] ?? t}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {landing && (
        <div className="geo-rankings">
          {rankings.map((r) => (
            <section key={r.title} className="geo-ranking">
              <header>
                <h2>{r.title}</h2>
                <button className="link" onClick={() => setMany({ ...r.params, vista: 'ranking' }, true)}>Ver el ranking completo →</button>
              </header>
              <div className="geo-strip">{r.items.map((p, i) => card(p, i + 1))}</div>
            </section>
          ))}
          <h2 className="geo-all">Explora todo</h2>
        </div>
      )}

      <div className="geo-tools">
        <p className="geo-count"><strong>{nf(list.length)}</strong> lugares</p>
        <button className={`geo-toggle ${inHints ? 'on' : ''}`} onClick={() => setMany({ pistas: inHints ? '' : '1' })}>
          <span className="geo-toggle-dot" />Con pistas de GeoGuessr <b>{nf(inHints ? list.length : withHints)}</b>
        </button>
        <button className={`geo-toggle ${unesco ? 'on' : ''}`} onClick={() => setMany({ unesco: unesco ? '' : '1' })}>
          <span className="geo-toggle-dot" />Patrimonio UNESCO
        </button>
        <div className="seg seg-sm geo-view">
          <button className={view === 'galeria' ? 'on' : ''} onClick={() => setMany({ vista: '' })}>Galería</button>
          <button className={view === 'ranking' ? 'on' : ''} onClick={() => setMany({ vista: 'ranking' })}>Ranking</button>
        </div>
      </div>
      <div className="geo-sorts" role="group" aria-label="Ordenar por">
        <span>Ordenar por</span>
        {sorts.map((s) => (
          <button key={s.id} className={`fx-chip-s ${sortId === s.id ? 'on' : ''}`} onClick={() => setMany({ orden: s.id })}>{s.label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty">Nada coincide. Prueba con otro tipo o país.</div>
      ) : view === 'ranking' ? (
        <ol className="geo-list">
          {list.slice(0, shown).map((p, i) => {
            const c = map.get(p.cc)
            const v = sort.value?.(p)
            return (
              <li key={p.id}>
                <button className="geo-row" onClick={() => setOpen(p)}>
                  <span className="geo-row-n">{v !== undefined || !sort.value ? i + 1 : '–'}</span>
                  <span className="geo-row-img">{p.th ? <img src={p.th} alt="" loading="lazy" /> : null}</span>
                  <span className="geo-row-main">
                    <strong>{p.n}</strong>
                    <span>{c?.flag} {c?.name_es ?? c?.name} · {PLACE_KIND[p.t] ?? 'Lugar'}{p.f?.unesco ? ' · UNESCO' : ''}</span>
                    {v !== undefined && <span className="geo-bar-v"><span style={{ width: `${Math.max(3, (v / maxValue) * 100)}%` }} /></span>}
                  </span>
                  <span className="geo-row-val">{v !== undefined && sort.unit ? sort.unit(v) : factLine(p.t, p.f)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="geo-grid">{list.slice(0, shown).map((p, i) => card(p, sort.value && sort.value(p) !== undefined ? i + 1 : undefined))}</div>
      )}
      {shown < list.length && <div ref={sentinel} className="lib-sentinel">Cargando más…</div>}

      {open && <PlaceMap places={[toPlace(open)]} index={0} onClose={() => setOpen(null)} />}
    </div>
  )
}
