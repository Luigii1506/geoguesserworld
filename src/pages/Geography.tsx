import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { REGION_ES } from '../lib/labels'
import { useCountries } from '../lib/data'
import { FAMILIES, geo, geoFetch, useGeo, useGeoPages, type GeoCard, type GeoCountryRow, type GeoList, type ListQuery } from '../lib/geo'
import { METRIC, SORT, SORTS, SORTS_FOR, TAG_GROUPS, kindCount, kindLabel, nf, popText, type TagGroup } from '../lib/geoFormat'
import { DataError, Loading, PlaceMap } from '../components/ui'
import { CountryPicker } from '../components/geo/CountryPicker'
import { GeoCardView, GeoRow } from '../components/geo/GeoCards'
import { CountryAtlas } from '../components/geo/CountryAtlas'
import { Omnibox } from '../components/geo/Omnibox'
import { Strip } from '../components/geo/Strip'
import { Sheet } from '../components/geo/Sheet'
import { Img } from '../components/Img'

const WorldMap = lazy(() => import('../components/WorldMap'))

// Geografía, en dos modos:
//   · Descubrir (sin filtros): buscador único, mapa para elegir país, tipos de
//     lugar con foto, rankings y "Sorpréndeme".
//   · Explorar (con búsqueda, país o tipo): barra compacta con lo elegido como
//     chips y el resto de filtros en un panel; al elegir país, su cabecera, su
//     mapa de terreno y lo más destacado de cada tipo.
// Todo lo filtra y ordena la API (docs/geo.md).

const CONTINENTS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
const PAGE = 36
// órdenes antiguos en enlaces guardados
const ORDER_ALIAS: Record<string, string> = {
  imp: 'rank', ele: 'elevation', len: 'length', pop: 'population', q: 'discharge', prom: 'prominence',
  le: 'last_eruption', vis: 'visitors', nc: 'countries', az: 'name',
}

// rankings de la portada
const RANKINGS: { title: string; query: ListQuery; params: Record<string, string> }[] = [
  { title: 'Los volcanes más altos', query: { kind: 'volcano', sort: 'elevation' }, params: { tipo: 'montanas', sub: 'volcano', orden: 'elevation', vista: 'ranking' } },
  { title: 'Las montañas más altas', query: { kind: 'mountain', sort: 'elevation' }, params: { tipo: 'montanas', sub: 'mountain', orden: 'elevation', vista: 'ranking' } },
  { title: 'Las áreas urbanas más pobladas', query: { kind: 'urban', sort: 'population' }, params: { tipo: 'ciudades', sub: 'urban', orden: 'population', vista: 'ranking' } },
  { title: 'Los ríos más largos', query: { kind: 'river', sort: 'length' }, params: { tipo: 'agua', sub: 'river', orden: 'length', vista: 'ranking' } },
  { title: 'Patrimonio de la Humanidad', query: { tags: ['unesco'], sort: 'rank' }, params: { unesco: '1' } },
  { title: 'Volcanes activos', query: { kind: 'volcano', tags: ['activo'], sort: 'rank' }, params: { tipo: 'montanas', sub: 'volcano', estado: 'activo' } },
  { title: 'Las islas más grandes', query: { kind: 'island', sort: 'area' }, params: { tipo: 'islas', sub: 'island', orden: 'area', vista: 'ranking' } },
  { title: 'Los lagos más grandes', query: { kind: 'lake', sort: 'area' }, params: { tipo: 'agua', sub: 'lake', orden: 'area', vista: 'ranking' } },
  { title: 'Los desiertos más extensos', query: { kind: 'desert', sort: 'area' }, params: { tipo: 'relieve', sub: 'desert', orden: 'area', vista: 'ranking' } },
]

// lo más destacado de un país: un carrusel por tipo
const HIGHLIGHTS: { title: string; query: ListQuery; params: Record<string, string> }[] = [
  { title: 'Ciudades', query: { kind: 'city', sort: 'population' }, params: { tipo: 'ciudades', sub: 'city', orden: 'population' } },
  { title: 'Volcanes y montañas', query: { family: 'montanas', sort: 'elevation' }, params: { tipo: 'montanas', orden: 'elevation' } },
  { title: 'Mares, ríos y lagos', query: { family: 'agua', sort: 'rank' }, params: { tipo: 'agua' } },
  { title: 'Monumentos', query: { family: 'monumentos', sort: 'rank' }, params: { tipo: 'monumentos' } },
  { title: 'Parques y naturaleza', query: { family: 'naturaleza', sort: 'rank' }, params: { tipo: 'naturaleza' } },
  { title: 'Islas y penínsulas', query: { family: 'islas', sort: 'area' }, params: { tipo: 'islas', orden: 'area' } },
  { title: 'Llanuras, mesetas y desiertos', query: { family: 'relieve', sort: 'area' }, params: { tipo: 'relieve', orden: 'area' } },
  { title: 'Templos e iglesias', query: { family: 'templos', sort: 'rank' }, params: { tipo: 'templos' } },
  { title: 'Arqueología', query: { family: 'arqueologia', sort: 'rank' }, params: { tipo: 'arqueologia' } },
]

type Countries = Map<string, GeoCountryRow>

/** Un carrusel de la API (ranking de la portada o destacado de un país). */
function ListStrip({ title, query, countries, onOpen, onAll, ranked, min = 3 }: {
  title: string
  query: ListQuery
  countries: Countries
  onOpen: (c: GeoCard) => void
  onAll: () => void
  ranked?: boolean
  min?: number
}) {
  const key = `strip:${JSON.stringify(query)}`
  const { data } = useGeo(key, () => geo.list({ ...query, limit: 12 }))
  const byValue = SORT.get(query.sort ?? 'rank')?.format !== undefined
  const items = (data?.items ?? []).filter((c) => !byValue || c.value != null)
  if (data && items.length < min) return null
  return (
    <Strip title={title} action="Ver todos" onAction={onAll} loading={!data}>
      {items.map((c, i) => <GeoCardView key={c.id} c={c} countries={countries} rank={ranked ? i + 1 : undefined} onOpen={onOpen} />)}
    </Strip>
  )
}

/** Tipos de lugar con la foto de su lugar más conocido. */
function FamilyTiles({ counts, onPick }: { counts: Record<string, number>; onPick: (id: string) => void }) {
  return (
    <div className="ftiles">
      {FAMILIES.map((f) => {
        const n = f.kinds.reduce((s, k) => s + (counts[k] ?? 0), 0)
        if (!n) return null
        return <FamilyTile key={f.id} id={f.id} label={f.label} n={n} onPick={onPick} />
      })}
    </div>
  )
}
function FamilyTile({ id, label, n, onPick }: { id: string; label: string; n: number; onPick: (id: string) => void }) {
  const { data } = useGeo(`tile:${id}`, () => geo.list({ family: id, photo: true, famous: true, sort: 'rank', limit: 1 }))
  const img = data?.items[0]?.thumb
  return (
    <button className="ftile" onClick={() => onPick(id)}>
      {img ? <Img src={img} sizes="(max-width: 600px) 46vw, 220px" /> : <span className="ftile-ph" />}
      <span className="ftile-text">
        <strong>{label}</strong>
        <em>{nf(n)}</em>
      </span>
    </button>
  )
}

export default function Geography() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState<GeoCard | null>(null)
  const [sheet, setSheet] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const meta = useGeo('meta', geo.meta)
  const countryRows = useGeo('countries', geo.countries)
  const worldRows = useCountries()
  const countries: Countries = useMemo(() => new Map((countryRows.data?.items ?? []).map((c) => [c.cc, c])), [countryRows.data])

  const fam = params.get('tipo') ?? ''
  const sub = params.get('sub') ?? ''
  const cont = params.get('continente') ?? ''
  const cc = params.get('pais') ?? ''
  const unesco = params.get('unesco') === '1'
  const inHints = params.get('pistas') === '1'
  const photo = params.get('foto') === '1'
  const view = params.get('vista') === 'ranking' ? 'ranking' : 'galeria'
  const family = FAMILIES.find((f) => f.id === fam)
  const rawSort = params.get('orden') ?? ''
  const sort = SORT.has(ORDER_ALIAS[rawSort] ?? rawSort) ? ORDER_ALIAS[rawSort] ?? rawSort : 'rank'
  const biomeLegend = meta.data?.layers.find((l) => l.id === 'biome')?.legend ?? []
  const allGroups: TagGroup[] = [...TAG_GROUPS, { id: 'bioma', label: 'Bioma', kinds: ['ecoregion'], tags: biomeLegend.map((b) => ({ tag: b.key, label: b.label })) }]
  const groups = allGroups.filter((g) => sub && g.kinds.includes(sub))
  const tags = [...(unesco ? ['unesco'] : []), ...groups.map((g) => params.get(g.id) ?? '').filter(Boolean)]
  const text = params.get('q') ?? ''
  const within = params.get('dentro') ?? ''
  const withinEntity = useGeo(within ? `entity:${within}` : null, () => geo.entity(within))

  const landing = !fam && !sub && !cont && !cc && !unesco && !inHints && !photo && !text && !rawSort && !within
  // solo el país elegido: su portada (mapa y destacados) en lugar de la lista
  const countryHome = Boolean(cc) && !fam && !sub && !text && !within && !unesco && !inHints && !photo && !rawSort
  const query: ListQuery = {
    q: text || undefined, family: sub ? undefined : fam || undefined, kind: sub || undefined, cc: cc || undefined,
    continent: cc ? undefined : cont || undefined, within: within || undefined, tags, hints: inHints, photo, sort,
  }
  const list = useGeoPages(landing || countryHome ? null : query, PAGE)
  const country = useGeo(cc ? `country:${cc}` : null, () => geo.country(cc))
  // cuántos hay de cada tipo en todo el mundo (para la portada)
  const world = useGeo(landing ? 'world-facets' : null, () => geo.list({ limit: 1, facets: true }))

  const setMany = (changes: Record<string, string>, top = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: false })
    if (top) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const groupReset = Object.fromEntries(allGroups.map((g) => [g.id, '']))
  const set = (k: string, v: string) =>
    setMany({
      [k]: v,
      ...(k === 'continente' ? { pais: '' } : {}),
      ...(k === 'tipo' ? { sub: '', orden: '', ...groupReset } : {}),
      ...(k === 'sub' ? groupReset : {}),
    })
  const clearAll = () => setParams(new URLSearchParams(), { replace: false })

  // la galería se va cargando al bajar
  useEffect(() => {
    const el = sentinel.current
    if (!el || list.done) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && list.more(), { rootMargin: '900px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.done, list.items.length, list.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadError = meta.error ?? countryRows.error
  if (loadError) return <DataError error={loadError} what="los datos de geografía" />
  if (!meta.data || !countryRows.data) return <Loading what="la geografía" />

  const openCard = (c: GeoCard) => setOpen(c)
  const surprise = async () => {
    const r = await geoFetch<GeoList>(`list?sort=random&photo=1&famous=1&limit=1&t=${Date.now()}`)
    if (r.items[0]) setOpen(r.items[0])
  }
  const pickCountry = (code: string) => setMany({ pais: code, continente: '', q: '', dentro: '' }, true)
  const totalPlaces = Object.entries(meta.data.totals).filter(([k]) => k !== 'country' && k !== 'admin1').reduce((n, [, v]) => n + v, 0)
  // contadores por tipo: los de la lista; en la portada del país, los del país; en la general, los del mundo
  const kindCountF = list.facets?.kinds ?? country.data?.counts ?? world.data?.facets?.kinds ?? {}
  const famCount = new Map(FAMILIES.map((f) => [f.id, f.kinds.reduce((n, k) => n + (kindCountF[k] ?? 0), 0)]))
  const sorts = SORTS.filter((s) => !fam || (SORTS_FOR[fam] ?? []).includes(s.id))
  const maxValue = Math.max(0, ...list.items.slice(0, 200).map((c) => (sort === 'hints' ? c.hints : c.value ?? 0)))
  const byValue = SORT.get(sort)?.format !== undefined
  const countryOptions = countryRows.data.items.filter((c) => c.places > 0).map((c) => ({ code: c.cc, n: c.places, flag: c.flag ?? '', name: c.name, alt: c.name_en ?? '' }))
  const popular = [...countryRows.data.items].filter((c) => c.guide).sort((a, b) => b.places - a.places).slice(0, 14)

  // chips de lo elegido (se quitan con ×)
  const chips: { key: string; label: string; clear: () => void }[] = [
    ...(text ? [{ key: 'q', label: `«${text}»`, clear: () => setMany({ q: '' }) }] : []),
    ...(cc && !countryHome ? [{ key: 'pais', label: `${countries.get(cc)?.flag ?? ''} ${countries.get(cc)?.name ?? cc}`, clear: () => setMany({ pais: '' }) }] : []),
    ...(cont ? [{ key: 'cont', label: REGION_ES[cont] ?? cont, clear: () => set('continente', '') }] : []),
    ...(family ? [{ key: 'tipo', label: family.label, clear: () => set('tipo', '') }] : []),
    ...(sub ? [{ key: 'sub', label: kindLabel(sub), clear: () => set('sub', '') }] : []),
    ...groups.flatMap((g) => {
      const v = params.get(g.id)
      return v ? [{ key: g.id, label: g.tags.find((t) => t.tag === v)?.label ?? v, clear: () => setMany({ [g.id]: '' }) }] : []
    }),
    ...(within ? [{ key: 'dentro', label: `Dentro de ${withinEntity.data?.name ?? '…'}`, clear: () => setMany({ dentro: '' }) }] : []),
    ...(inHints ? [{ key: 'pistas', label: 'Con pistas de GeoGuessr', clear: () => setMany({ pistas: '' }) }] : []),
    ...(unesco ? [{ key: 'unesco', label: 'Patrimonio UNESCO', clear: () => setMany({ unesco: '' }) }] : []),
    ...(photo ? [{ key: 'foto', label: 'Con foto', clear: () => setMany({ foto: '' }) }] : []),
  ]

  const omnibox = (big: boolean) => (
    <Omnibox
      big={big}
      countries={countryRows.data!.items}
      value={text}
      onSearch={(q) => setMany({ q }, !big)}
      onCountry={pickCountry}
      onPlace={openCard}
    />
  )

  const filters = (
    <div className="gf">
      <section>
        <h3>Tipo de lugar</h3>
        <div className="gf-chips">
          <button className={`fx-chip-t ${!fam ? 'on' : ''}`} onClick={() => set('tipo', '')}>Todos</button>
          {FAMILIES.filter((f) => famCount.get(f.id) || fam === f.id).map((f) => (
            <button key={f.id} className={`fx-chip-t ${fam === f.id ? 'on' : ''}`} onClick={() => set('tipo', fam === f.id ? '' : f.id)}>
              {f.label} <span>{nf(famCount.get(f.id) ?? 0)}</span>
            </button>
          ))}
        </div>
        {family && family.kinds.filter((k) => kindCountF[k]).length > 1 && (
          <div className="gf-chips gf-sub">
            {family.kinds.filter((k) => kindCountF[k]).map((k) => (
              <button key={k} className={`fx-chip-s ${sub === k ? 'on' : ''}`} onClick={() => set('sub', sub === k ? '' : k)}>
                {kindLabel(k)} <span>{nf(kindCountF[k])}</span>
              </button>
            ))}
          </div>
        )}
      </section>
      {groups.map((g) => {
        const cur = params.get(g.id) ?? ''
        const vals = g.tags.filter((t) => (list.facets?.tags[t.tag] ?? 0) > 0 || t.tag === cur)
        if (!vals.length) return null
        return (
          <section key={g.id}>
            <h3>{g.label}</h3>
            <div className="gf-chips">
              {vals.map((t) => (
                <button key={t.tag} title={t.help} className={`fx-chip-s geo-f-${t.tag} ${cur === t.tag ? 'on' : ''}`} onClick={() => setMany({ [g.id]: cur === t.tag ? '' : t.tag })}>
                  {t.label} <span>{nf(list.facets?.tags[t.tag] ?? 0)}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
      <section>
        <h3>Dónde</h3>
        <div className="seg seg-sm gf-cont">
          <button className={!cont && !cc ? 'on' : ''} onClick={() => setMany({ continente: '', pais: '' })}>Mundo</button>
          {CONTINENTS.map((r) => (
            <button key={r} className={cont === r ? 'on' : ''} onClick={() => set('continente', cont === r ? '' : r)}>{REGION_ES[r]}</button>
          ))}
        </div>
        <CountryPicker value={cc} onChange={(v) => setMany({ pais: v, continente: v ? '' : cont })} options={countryOptions} />
      </section>
      <section>
        <h3>Mostrar solo</h3>
        <div className="gf-toggles">
          {([
            ['pistas', inHints, `Con pistas de GeoGuessr${list.facets ? ` (${nf(list.facets.hints)})` : ''}`],
            ['unesco', unesco, 'Patrimonio UNESCO'],
            ['foto', photo, 'Con foto'],
          ] as const).map(([k, on, label]) => (
            <button key={k} className={`geo-toggle ${on ? 'on' : ''}`} onClick={() => setMany({ [k]: on ? '' : '1' })}>
              <span className="geo-toggle-dot" />{label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )

  const c = country.data
  const pop = c?.entity.facts.find((f) => f.key === 'population')?.value as number | undefined
  const area = c?.entity.facts.find((f) => f.key === 'area')?.value as number | undefined

  return (
    <div className={`geo ${landing ? 'geo-landing' : 'geo-explore'}`}>
      {landing ? (
        <>
          <header className="gh">
            <span className="eyebrow">Geografía</span>
            <h1>El mundo, lugar a lugar</h1>
            <p className="lead">{nf(totalPlaces)} volcanes, ríos, montañas, ciudades, mares y monumentos para ver dónde están y cómo son.</p>
            {omnibox(true)}
            <div className="gh-actions">
              <button className="btn" onClick={surprise}>🎲 Sorpréndeme</button>
              <span className="muted small">o elige un país en el mapa ↓</span>
            </div>
          </header>

          <section className="gsec">
            <header className="gsec-head">
              <h2>Elige un país</h2>
              <p>Su mapa de relieve, vegetación, cultivos y clima, y lo más destacado que tiene.</p>
            </header>
            <div className="gmap">
              {worldRows ? (
                <Suspense fallback={<div className="wm-loading">Cargando mapa…</div>}>
                  <WorldMap
                    countries={worldRows}
                    onSelect={(w) => pickCountry(w.code)}
                    paint={(w) => (countries.get(w.code)?.places ? `color-mix(in oklab, var(--accent) ${Math.round(18 + 70 * Math.min(1, Math.log10(1 + (countries.get(w.code)?.places ?? 0)) / 4.3))}%, var(--map-land))` : undefined)}
                    card={(w) => (
                      <>
                        <div className="wm-card-stats"><span><b>{nf(countries.get(w.code)?.places ?? 0)}</b> lugares</span></div>
                        <div className="wm-card-cta">Ver país →</div>
                      </>
                    )}
                    legend={<div className="worldmap-legend"><span>Toca un país para abrirlo</span></div>}
                  />
                </Suspense>
              ) : null}
            </div>
            <div className="gpopular">
              {popular.map((p) => (
                <button key={p.cc} className="gpop" onClick={() => pickCountry(p.cc)}>
                  <span>{p.flag}</span>{p.name}
                </button>
              ))}
            </div>
          </section>

          <section className="gsec">
            <header className="gsec-head"><h2>¿Qué quieres ver?</h2></header>
            <FamilyTiles counts={world.data?.facets?.kinds ?? meta.data.totals} onPick={(id) => set('tipo', id)} />
          </section>

          <section className="gsec">
            <header className="gsec-head"><h2>Rankings del mundo</h2></header>
            <div className="gstrips">
              {RANKINGS.map((r) => (
                <ListStrip key={r.title} title={r.title} query={r.query} countries={countries} onOpen={openCard} ranked onAll={() => setMany(r.params, true)} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="gbar">
            <div className="gbar-row">
              {omnibox(false)}
              <button className="btn gbar-filters" onClick={() => setSheet(true)}>
                Filtros{chips.length ? <b>{chips.length}</b> : null}
              </button>
            </div>
            <div className="gbar-chips">
              <button className="link" onClick={clearAll}>← Inicio</button>
              {chips.map((x) => (
                <button key={x.key} className="fx-chip" onClick={x.clear}>{x.label} <span>×</span></button>
              ))}
            </div>
          </div>

          {/* país elegido: cabecera con sus datos; en su portada, además, mapa y destacados */}
          {cc && c && (
            <section className={`gcountry ${countryHome ? '' : 'gcountry-compact'}`}>
              <div className="gcountry-head">
                <span className="flag">{c.flag}</span>
                <div className="gcountry-name">
                  <h1>{c.name}</h1>
                  <p>
                    {[pop ? popText(pop) : null, area ? METRIC.get('area')!.format(area) : null, `${nf(countries.get(cc)?.places ?? 0)} lugares`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="gcountry-links">
                  {!countryHome && <button className="link" onClick={() => setMany({ tipo: '', sub: '', q: '', dentro: '', orden: '', ...groupReset })}>Ver el país →</button>}
                  {c.guide && <a className="link" href={`#/pais/${cc}`}>Guía de GeoGuessr →</a>}
                  <button className="link" onClick={() => setMany({ pais: '' })}>Cambiar de país</button>
                </div>
              </div>
              {countryHome && (
                <>
                  <CountryAtlas country={c} onOpen={openCard} />
                  <div className="geo-country-types">
                    {FAMILIES.flatMap((f) => f.kinds).map((k) => {
                      const n = c.counts[k]
                      if (!n) return null
                      return (
                        <button key={k} className="geo-ctype" onClick={() => setMany({ tipo: FAMILIES.find((f) => f.kinds.includes(k))!.id, sub: k })}>
                          <strong>{nf(n)}</strong>
                          <span>{kindCount(k, n).replace(/^[\d.]+ /, '')}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {countryHome ? (
            <div className="gstrips">
              {HIGHLIGHTS.map((h) => (
                <ListStrip key={h.title} title={`${h.title} de ${c?.name ?? ''}`} query={{ ...h.query, cc }} countries={countries} onOpen={openCard} min={2} onAll={() => setMany(h.params, true)} />
              ))}
            </div>
          ) : (
            <>
              <div className="gresults-head">
                <p className="geo-count"><strong>{nf(list.total)}</strong> {list.total === 1 ? 'lugar' : 'lugares'}</p>
                <label className="gsort">
                  <span>Ordenar</span>
                  <select className="input" value={sort} onChange={(e) => setMany({ orden: e.target.value === 'rank' ? '' : e.target.value })}>
                    {sorts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <div className="seg seg-sm geo-view">
                  <button className={view === 'galeria' ? 'on' : ''} onClick={() => setMany({ vista: '' })}>Galería</button>
                  <button className={view === 'ranking' ? 'on' : ''} onClick={() => setMany({ vista: 'ranking' })}>Ranking</button>
                </div>
              </div>

              {list.error ? (
                <DataError error={list.error} what="esta lista" />
              ) : list.items.length === 0 && !list.loading ? (
                <div className="empty">Nada coincide. <button className="link" onClick={clearAll}>Empieza de nuevo</button></div>
              ) : view === 'ranking' ? (
                <ol className={`geo-list ${list.stale ? 'is-stale' : ''}`}>
                  {list.items.map((x, i) => (
                    <GeoRow key={x.id} c={x} countries={countries} n={!byValue || x.value != null || sort === 'hints' ? i + 1 : null} sort={sort} max={maxValue} onOpen={openCard} />
                  ))}
                </ol>
              ) : (
                <div className={`geo-grid ${list.stale ? 'is-stale' : ''}`}>
                  {list.items.map((x, i) => (
                    <GeoCardView key={x.id} c={x} countries={countries} rank={byValue && x.value != null ? i + 1 : undefined} onOpen={openCard} />
                  ))}
                </div>
              )}
              {!list.done && <div ref={sentinel} className="lib-sentinel">Cargando más…</div>}
            </>
          )}
        </>
      )}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtros"
        footer={
          <>
            <button className="link" onClick={clearAll}>Quitar todo</button>
            <button className="btn btn-primary" onClick={() => setSheet(false)}>Ver {nf(list.facets ? list.total : cc ? countries.get(cc)?.places ?? 0 : totalPlaces)} lugares</button>
          </>
        }
      >
        {filters}
      </Sheet>

      {open && (
        <PlaceMap places={[{ id: open.id, n: open.name_en ?? open.name, es: open.name, lat: open.lat, lng: open.lng, k: open.kind, cc: open.cc }]} index={0} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
