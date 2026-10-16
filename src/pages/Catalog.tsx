import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { countryFlag, countryLabel, useCountryFile, useCountryMap, useMetaObjects, type CountryRow, type MetaObject } from '../lib/data'
import { COLOR_HEX, OBJECT_CATEGORY, OBJECT_LABEL, REGION_ES, VARIANT_LABEL, attrLabel, valueLabel } from '../lib/labels'
import { Img } from '../components/Img'
import { CountryChip, DataError, HintText, Loading, Swatch } from '../components/ui'
import { hintText, useLang } from '../lib/i18n'
import { SaveButton } from '../components/study/SaveButton'
import { itemKey, type NewItem } from '../lib/study/store'

const WorldMap = lazy(() => import('../components/WorldMap'))

// Catálogo: un tipo de objeto de meta (bolardos, postes, matrículas…) en todos los países a la
// vez, con una ficha por país (su versión principal, sus rasgos y sus variantes). Se filtra por
// continente y por rasgo ("cuerpo blanco", "reflector rojo") y se ve en cuadrícula o en el mapa.
// Los datos son el índice de objetos de las guías (community/meta-objects.json).
// Todo vive en la URL: ?tipo=bollard&continente=Europe&rasgos=body_color:white&vista=mapa&pais=hu

const ORDER = ['bollard', 'utility_pole', 'licence_plate', 'google_car', 'road_lines', 'sign_back', 'chevron', 'warning_sign', 'stop_sign', 'guardrail']
const PLURAL: Record<string, string> = {
  bollard: 'Bolardos', utility_pole: 'Postes', licence_plate: 'Matrículas', google_car: 'Coche de Google', road_lines: 'Líneas viales',
  sign_back: 'Traseras de señales', chevron: 'Chevrones', warning_sign: 'Señales de advertencia', stop_sign: 'Señales de stop', guardrail: 'Guardarraíles',
}
const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
const VARIANT_ORDER = { main: 0, regional: 1, special: 2, old: 3 }
const NO_VALUE = '#d9d6ce'
// rasgos que se ven sin desplegar (el resto, con «Más rasgos»)
const FACETS_SHOWN = 3

type Entry = { cc: string; main: MetaObject; all: MetaObject[] }

/** Lo guardable de un objeto (su foto, en el tema de la guía al que pertenece). */
function objectItem(o: MetaObject): NewItem | null {
  if (!o.img) return null
  return {
    key: itemKey.photo(o.img),
    kind: 'photo',
    cc: o.country,
    data: { img: o.img, cat: OBJECT_CATEGORY[o.type] ?? o.type, catName: OBJECT_LABEL[o.type]?.label, text: [o.region, ...o.features].filter(Boolean).join(' · ') || undefined },
  }
}

export default function Catalog() {
  const file = useMetaObjects()
  const map = useCountryMap()
  const [params, setParams] = useSearchParams()
  const type = ORDER.includes(params.get('tipo') ?? '') ? params.get('tipo')! : 'bollard'
  const region = params.get('continente') ?? ''
  const view = params.get('vista') === 'mapa' ? 'mapa' : 'cuadricula'
  const open = params.get('pais')
  const picked = useMemo(() => new Map((params.get('rasgos') ?? '').split(',').filter(Boolean).map((x) => x.split(':') as [string, string])), [params])
  const [q, setQ] = useState('')
  // en el móvil los rasgos empiezan plegados; en escritorio, los primeros a la vista
  const [allFacets, setAllFacets] = useState(false)
  const [facetsOpen, setFacetsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 640)
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setParams(next, { replace: true })
  }
  const toggleTrait = (k: string, v: string) => {
    const m = new Map(picked)
    if (m.get(k) === v) m.delete(k)
    else m.set(k, v)
    set({ rasgos: [...m].map(([a, b]) => `${a}:${b}`).join(',') || null })
  }

  // una ficha por país: la versión principal (o la primera) y todas sus variantes
  const entries = useMemo(() => {
    const by = new Map<string, MetaObject[]>()
    for (const o of file?.objects ?? []) if (o.type === type) by.set(o.country, [...(by.get(o.country) ?? []), o])
    return [...by].map(([cc, all]): Entry => {
      const sorted = [...all].sort((a, b) => VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant] || Number(Boolean(b.img)) - Number(Boolean(a.img)))
      return { cc, main: sorted[0], all: sorted }
    })
  }, [file, type])

  // un país cumple un rasgo si alguna de sus versiones lo tiene
  const has = (e: Entry, k: string, v: string) => e.all.some((o) => o.attrs[k] === v)
  const inRegion = (e: Entry) => !region || map.get(e.cc)?.region === region
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const matchQ = (e: Entry) => !q || fold(countryLabel(map, e.cc)).includes(fold(q))
  const shown = entries
    .filter((e) => inRegion(e) && matchQ(e) && [...picked].every(([k, v]) => has(e, k, v)))
    .sort((a, b) => countryLabel(map, a.cc).localeCompare(countryLabel(map, b.cc), 'es'))

  // rasgos disponibles con cuántos países los tienen (con los demás filtros aplicados)
  const facets = useMemo(() => {
    const base = entries.filter((e) => inRegion(e) && matchQ(e))
    const keys = new Map<string, Map<string, number>>()
    for (const e of base) {
      const seen = new Set<string>()
      for (const o of e.all) for (const [k, v] of Object.entries(o.attrs)) seen.add(`${k}\u0000${v}`)
      for (const s of seen) {
        const [k, v] = s.split('\u0000')
        // cuenta solo los países que también cumplen los otros rasgos elegidos
        if (![...picked].every(([pk, pv]) => pk === k || has(e, pk, pv))) continue
        const m = keys.get(k) ?? new Map<string, number>()
        m.set(v, (m.get(v) ?? 0) + 1)
        keys.set(k, m)
      }
    }
    return [...keys].map(([k, m]) => ({ key: k, values: [...m].sort((a, b) => b[1] - a[1]) })).filter((f) => f.values.length > 1 || picked.has(f.key))
  }, [entries, region, q, picked, map]) // eslint-disable-line react-hooks/exhaustive-deps

  if (file === null) return <DataError error="no se pudo cargar el índice de objetos" what="el catálogo" />
  if (!file || !map.size) return <Loading what="el catálogo" />

  const countsByType = Object.fromEntries(ORDER.map((t) => [t, new Set(file.objects.filter((o) => o.type === t).map((o) => o.country)).size]))
  const groups = region ? [[region, shown] as const] : REGIONS.map((r) => [r, shown.filter((e) => map.get(e.cc)?.region === r)] as const).filter(([, l]) => l.length)
  const openEntry = open ? entries.find((e) => e.cc === open) : undefined

  return (
    <div className="catalog">
      <header className="page-head">
        <h1>Catálogo</h1>
        <p className="lead">Cada objeto de meta, en todos los países a la vez. Compara cómo es en cada sitio y filtra por lo que ves en la ronda.</p>
      </header>

      <nav className="cat-types" aria-label="Tipo de objeto">
        {ORDER.map((t) => (
          <button key={t} className={`cat-type ${t === type ? 'on' : ''}`} onClick={() => set({ tipo: t === 'bollard' ? null : t, rasgos: null, pais: null })}>
            {PLURAL[t]} <span className="muted">{countsByType[t]}</span>
          </button>
        ))}
        <Link to="/explorar" className="cat-type cat-more">Más temas en Explorar →</Link>
      </nav>

      <div className="toolbar cat-toolbar">
        <div className="seg">
          <button className={!region ? 'on' : ''} onClick={() => set({ continente: null })}>Todo</button>
          {REGIONS.map((r) => <button key={r} className={region === r ? 'on' : ''} onClick={() => set({ continente: r })}>{REGION_ES[r]}</button>)}
        </div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un país" aria-label="Buscar un país" />
        <div className="seg seg-sm">
          <button className={view === 'cuadricula' ? 'on' : ''} onClick={() => set({ vista: null })}>Cuadrícula</button>
          <button className={view === 'mapa' ? 'on' : ''} onClick={() => set({ vista: 'mapa' })}>Mapa</button>
        </div>
      </div>

      {facets.length > 0 && !facetsOpen && (
        <button className="btn cat-facets-toggle" onClick={() => setFacetsOpen(true)}>
          Filtrar por rasgos{picked.size ? ` (${picked.size})` : ''}
        </button>
      )}
      {facets.length > 0 && facetsOpen && (
        <div className="cat-facets">
          {(allFacets ? facets : facets.slice(0, Math.max(FACETS_SHOWN, ...[...picked.keys()].map((k) => facets.findIndex((f) => f.key === k) + 1)))).map((f) => (
            <div key={f.key} className="cat-facet">
              <span className="eyebrow">{attrLabel(f.key)}</span>
              <div className="chips">
                {f.values.map(([v, n]) => (
                  <button key={v} className={`chip ${picked.get(f.key) === v ? 'on' : ''}`} onClick={() => toggleTrait(f.key, v)}>
                    <Swatch value={v} /> {valueLabel(v)} <span className="muted">{n}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="row cat-facets-foot">
            {facets.length > FACETS_SHOWN && (
              <button className="link" onClick={() => setAllFacets(!allFacets)}>{allFacets ? 'Menos rasgos' : `Más rasgos (${facets.length - FACETS_SHOWN})`}</button>
            )}
            {picked.size > 0 && <button className="link" onClick={() => set({ rasgos: null })}>Quitar filtros de rasgos</button>}
            {window.innerWidth <= 640 && <button className="link" onClick={() => setFacetsOpen(false)}>Ocultar</button>}
          </div>
        </div>
      )}

      <p className="muted small">
        {shown.length} {shown.length === 1 ? 'país' : 'países'}
        {picked.size > 0 && <> con {[...picked].map(([k, v]) => `${attrLabel(k).toLowerCase()} ${valueLabel(v)}`).join(' y ')}</>}
      </p>

      {view === 'mapa' ? (
        <CatalogMap type={type} entries={entries} shown={shown} onOpen={(cc) => set({ pais: cc })} />
      ) : shown.length === 0 ? (
        <div className="empty">Ningún país coincide. <button className="link" onClick={() => (set({ rasgos: null, continente: null }), setQ(''))}>Quitar los filtros</button></div>
      ) : (
        groups.map(([r, list]) => (
          <section key={r} className="cat-group">
            {!region && <h2>{REGION_ES[r]} <span className="muted small">{list.length}</span></h2>}
            <div className="cat-grid">
              {list.map((e) => <CountryTile key={e.cc} e={e} picked={picked} onOpen={() => set({ pais: e.cc })} />)}
            </div>
          </section>
        ))
      )}

      {openEntry && <CountryDetail e={openEntry} type={type} onClose={() => set({ pais: null })} />}
    </div>
  )
}

/** Ficha de un país en la cuadrícula: la foto de su versión principal y sus rasgos clave. */
function CountryTile({ e, picked, onOpen }: { e: Entry; picked: Map<string, string>; onOpen: () => void }) {
  const map = useCountryMap()
  // si se filtra por un rasgo, se enseña la versión que lo cumple
  const o = e.all.find((x) => [...picked].every(([k, v]) => x.attrs[k] === v)) ?? e.main
  const img = o.img ?? e.all.find((x) => x.img)?.img
  const attrs = Object.entries(o.attrs).slice(0, 3)
  const variants = e.all.length - 1
  const save = objectItem(o)
  return (
    <div className="cat-tile-wrap">
      <button className="cat-tile" onClick={onOpen}>
        <span className="cat-img">{img ? <Img src={img} sizes="(max-width: 600px) 46vw, 220px" /> : <span className="muted small">Sin foto</span>}</span>
        <span className="cat-body">
          <strong>{countryFlag(map, e.cc)} {countryLabel(map, e.cc)}</strong>
          {o.variant !== 'main' && <span className="muted small">{VARIANT_LABEL[o.variant]}{o.region ? ` · ${o.region}` : ''}</span>}
          <span className="cat-attrs">
            {attrs.map(([k, v]) => <span key={k} title={attrLabel(k)}><Swatch value={v} /> {valueLabel(v)}</span>)}
          </span>
          {variants > 0 && <span className="cat-variants">+{variants} {variants === 1 ? 'variante' : 'variantes'}</span>}
        </span>
      </button>
      {save && <span className="cat-save"><SaveButton compact item={save} /></span>}
    </div>
  )
}

/**
 * Todas las versiones de un país (principal, regionales, especiales, antiguas): la foto y lo que
 * dicen sus pistas (de la guía del país), con qué se confunde y quién comparte el diseño.
 */
function CountryDetail({ e, type, onClose }: { e: Entry; type: string; onClose: () => void }) {
  const map = useCountryMap()
  const lang = useLang()
  const file = useCountryFile(e.cc)
  const hints = useMemo(() => new Map((file?.hints ?? []).map((h) => [h.id, h])), [file])
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const twins = [...new Set(e.all.flatMap((o) => o.confusedWith.map((c) => c.country)))]
  /** Los textos de las pistas de una versión, sin repetir (varias fuentes dicen lo mismo). */
  const textsOf = (o: MetaObject) => {
    const seen = new Set<string>()
    return o.hints
      .map((id) => hints.get(id))
      .filter((h): h is NonNullable<typeof h> => Boolean(h))
      .map((h) => hintText(h, lang).trim())
      .filter((t) => {
        const sig = t.toLowerCase().slice(0, 60)
        return t && !seen.has(sig) && seen.add(sig)
      })
      .slice(0, 3)
  }
  return createPortal(
    <div className="pm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-box cat-detail" onClick={(ev) => ev.stopPropagation()}>
        <div className="pm-head">
          <div>
            <span className="eyebrow">{PLURAL[type]}</span>
            <strong>{countryFlag(map, e.cc)} {countryLabel(map, e.cc)}</strong>
            <span className="pm-desc">{e.all.length} {e.all.length === 1 ? 'versión' : 'versiones'}</span>
          </div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="pm-body cat-detail-body">
          {e.all.map((o) => {
            const save = objectItem(o)
            const texts = textsOf(o)
            const label = [o.variant !== 'main' ? VARIANT_LABEL[o.variant] : 'Principal', o.region].filter(Boolean).join(' · ')
            return (
              <article key={o.id} className="cat-version">
                {o.img && <Img className="cat-version-img" src={o.img} size="img" sizes="(max-width: 700px) 92vw, 420px" />}
                <div className="cat-version-text">
                  <span className="eyebrow">{label}</span>
                  {texts.length > 0 ? texts.map((t, i) => <HintText key={i} text={t} />) : file === undefined ? <p className="muted small">Cargando…</p> : <p className="muted small">{o.features.join(' · ')}</p>}
                  {o.confusedWith.length > 0 && (
                    <div className="cat-twins">
                      <span className="muted small">Se confunde con</span>
                      {o.confusedWith.map((c) => (
                        <p key={c.country} className="small">
                          <Link to={`/duelo?a=${e.cc}&b=${c.country}`} onClick={onClose}>{countryFlag(map, c.country)} {countryLabel(map, c.country)}</Link>
                          {c.difference ? ` — ${c.difference}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {o.alsoIn.length > 0 && (
                    <div className="chips">
                      <span className="muted small">También en</span>
                      {o.alsoIn.map((c) => <CountryChip key={c} code={c} map={map} />)}
                    </div>
                  )}
                  {save && <SaveButton item={save} />}
                </div>
              </article>
            )
          })}
          <div className="row cat-detail-links">
            <Link to={`/pais/${e.cc}`} className="btn btn-primary" onClick={onClose}>Guía de {countryLabel(map, e.cc)}</Link>
            {twins.slice(0, 3).map((t) => (
              <Link key={t} to={`/duelo?a=${e.cc}&b=${t}`} className="btn" onClick={onClose}>Duelo con {countryFlag(map, t)} {countryLabel(map, t)}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** El tipo en el mapa: cada país teñido según un rasgo (el que se elija), con su leyenda. */
function CatalogMap({ type, entries, shown, onOpen }: { type: string; entries: Entry[]; shown: Entry[]; onOpen: (cc: string) => void }) {
  const map = useCountryMap()
  const countries = useMemo(() => [...map.values()], [map])
  // los rasgos que se pueden pintar: con color, o con pocos valores
  const keys = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of entries) for (const [k, v] of Object.entries(e.main.attrs)) m.set(k, (m.get(k) ?? new Set()).add(v))
    const coverage = (k: string) => entries.filter((e) => e.main.attrs[k]).length
    const colored = (vs: Set<string>) => Number([...vs].some((v) => COLOR_HEX[v]))
    return [...m]
      .filter(([, vs]) => vs.size >= 2 && vs.size <= 8)
      .sort((a, b) => coverage(b[0]) - coverage(a[0]) || colored(b[1]) - colored(a[1]))
      .map(([k]) => k)
  }, [entries])
  const [key, setKey] = useState(keys[0] ?? '')
  useEffect(() => setKey(keys[0] ?? ''), [type]) // eslint-disable-line react-hooks/exhaustive-deps
  const shownSet = new Set(shown.map((e) => e.cc))
  const byCc = new Map(entries.map((e) => [e.cc, e]))
  const values = [...new Set(entries.map((e) => e.main.attrs[key]).filter(Boolean))]
  const PALETTE = ['#1f6b55', '#c9793d', '#3d6fc9', '#b4432f', '#c9a43d', '#7a5ab8', '#4d9a9a', '#8a8a8a']
  const colorOf = (v: string) => COLOR_HEX[v] ?? PALETTE[values.indexOf(v) % PALETTE.length]
  const paint = (c: CountryRow) => {
    const e = byCc.get(c.code)
    if (!e || !shownSet.has(c.code)) return undefined
    const v = e.main.attrs[key]
    return v ? colorOf(v) : NO_VALUE
  }
  return (
    <section className="cat-map">
      {keys.length > 0 && (
        <label className="setting-inline">
          <span className="muted small">Colorear por</span>
          <select className="select" value={key} onChange={(ev) => setKey(ev.target.value)}>
            {keys.map((k) => <option key={k} value={k}>{attrLabel(k)}</option>)}
          </select>
        </label>
      )}
      <Suspense fallback={<div className="empty">Cargando mapa…</div>}>
        <WorldMap
          countries={countries}
          paint={paint}
          onSelect={(c) => byCc.has(c.code) && onOpen(c.code)}
          card={(c) => {
            const e = byCc.get(c.code)
            if (!e) return <span className="muted">Sin datos de este objeto</span>
            return <span>{Object.entries(e.main.attrs).slice(0, 3).map(([k, v]) => `${attrLabel(k)}: ${valueLabel(v)}`).join(' · ')}</span>
          }}
          legend={
            <div className="cat-legend">
              {values.map((v) => <span key={v}><i style={{ background: colorOf(v) }} /> {valueLabel(v)}</span>)}
              <span><i style={{ background: NO_VALUE }} /> sin este dato</span>
            </div>
          }
        />
      </Suspense>
    </section>
  )
}
