import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { type Cluster, type CountryRow, type Hint, type MetaObject, useMetaObjects } from '../lib/data'
import { hintText, useLang, type Lang } from '../lib/i18n'
import { COLOR_HEX, OBJECT_LABEL, SOURCE_NAMES, SUBCATEGORY_LABEL, USEFULNESS, attrLabel, valueLabel } from '../lib/labels'
import { NATIONAL, TOPIC_MAP_LAYER, type Part, type Topic, firstSentence, recognise, useGuide } from '../lib/guide'
import { imageSrc } from '../lib/images'
import { countryStreetView } from '../data/capitals'
import { HintItem, Lightbox, Loading, MissingData, ObjectProfile, PhotoTiles } from '../components/ui'
import { HintList, Variants, mainObjects, variantObjects } from '../components/guide'
import { CountryTerrain } from '../components/geo/CountryTerrain'

// La guía de un país es una sola página continua, como una landing:
//   1 Reconócelo · 2 No lo confundas · 3 Ubícate · y la biblioteca entera,
//   tema por tema, que se va cargando sola al bajar.
// El índice (lateral en escritorio, barra deslizable en el móvil) lleva a
// cada parte; los filtros (determinantes, con foto, región, fuente, texto)
// afinan toda la página con una transición. Todo vive en la URL.

const CHAPTERS = [
  { id: 'reconocer', n: 1, label: 'Reconócelo' },
  { id: 'meta', n: 2, label: 'Memoriza su meta' },
  { id: 'ubicate', n: 3, label: 'Ubícate' },
]

// Rutina de escaneo: el orden en que conviene recorrer una imagen de Street View,
// con el tipo de objeto de meta que resume cada tema.
const SCAN: { cat: string; types: string[]; look: string }[] = [
  { cat: 'google_car', types: ['google_car'], look: 'Mira el coche y la cámara' },
  { cat: 'road_lines', types: ['road_lines'], look: 'Baja la vista a la carretera' },
  { cat: 'bollards', types: ['bollard'], look: 'Busca un bolardo en el arcén' },
  { cat: 'poles', types: ['utility_pole'], look: 'Fíjate en los postes' },
  { cat: 'plates', types: ['licence_plate'], look: 'Si hay coches, la matrícula' },
  { cat: 'signs', types: ['stop_sign', 'warning_sign', 'chevron', 'sign_back'], look: 'Lee las señales' },
  { cat: 'guardrails', types: ['guardrail'], look: 'Los guardarraíles' },
  { cat: 'language', types: [], look: 'Y el idioma de cualquier texto' },
]
// rasgos que no aportan a la receta (o son demasiado genéricos)
const SKIP_VALUES = new Set(['other', 'unknown'])
const FKEYS = ['q', 'ver', 'region', 'imp', 'foto', 'multi', 'fuente'] as const
// Enfoques: lo que se suele querer memorizar, a un toque (se pueden combinar)
const FOCUS = [
  { id: 'bolardos', label: 'Bolardos', cats: ['bollards'] },
  { id: 'matriculas', label: 'Matrículas', cats: ['plates', 'vehicles'] },
  { id: 'postes', label: 'Postes', cats: ['poles'] },
  { id: 'carretera', label: 'Carretera', cats: ['road_lines', 'road_surface', 'guardrails', 'milestones', 'road_numbering', 'driving_side'] },
  { id: 'senales', label: 'Señales', cats: ['signs'] },
  { id: 'coche', label: 'Coche y cámara', cats: ['google_car', 'camera', 'coverage'] },
  { id: 'idioma', label: 'Idioma', cats: ['language', 'naming', 'phone', 'domain'] },
  { id: 'entorno', label: 'Entorno', cats: ['architecture', 'street_furniture', 'culture', 'landscape', 'landmarks', 'sun'] },
]
const FOCUS_OF = new Map(FOCUS.flatMap((x) => x.cats.map((c) => [c, x.id] as const)))
type FKey = (typeof FKEYS)[number]
type Filters = Partial<Record<FKey, string>>
const topicId = (cat: string) => `t-${cat}`
const subId = (cat: string, sub: string | null) => `t-${cat}-${sub ?? 'x'}`
const FIRST = 4 // pistas por subtema al cargar; el resto llega al bajar
const MORE = 12

/**
 * Salto a una parte de la guía sin cambiar de ruta (HashRouter). Los temas se
 * montan y cambian de altura al acercarse, así que un desplazamiento suave
 * largo erraría el destino: se salta directo, se reajusta hasta que la
 * posición es estable y la cabecera de destino se ilumina un momento.
 */
function jump(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const offset = window.innerWidth < 1000 ? 150 : 80
  const near = Math.abs(el.getBoundingClientRect().top) < window.innerHeight * 1.5
  if (near) {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' })
  } else {
    // se reajusta cada fotograma hasta que el destino lleve 8 fotogramas quieto (máx. ~1,5 s)
    let frames = 0
    let still = 0
    const settle = () => {
      const top = el.getBoundingClientRect().top
      if (Math.abs(top - offset) > 2) {
        window.scrollTo({ top: top + window.scrollY - offset, behavior: 'auto' })
        still = 0
      } else still++
      if (still < 8 && ++frames < 90) requestAnimationFrame(settle)
    }
    settle()
  }
  document.querySelectorAll('.flash').forEach((x) => x.classList.remove('flash'))
  void el.offsetWidth
  el.classList.add('flash')
}

/** Cambios de filtro con transición (View Transitions donde el navegador la tenga). */
function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    doc.startViewTransition(() => flushSync(update))
  } else update()
}

/** Sección visible: la última cuya cabecera ya pasó el 30 % de la pantalla. */
function useActive(ids: string[]) {
  const [active, setActive] = useState('')
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        let cur = ''
        for (const id of ids) {
          const el = document.getElementById(id)
          if (el && el.getBoundingClientRect().top < window.innerHeight * 0.3) cur = id
        }
        setActive(cur)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [ids.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  return active
}

// Memoria entre montajes: cuántas pistas había cargadas en cada subtema y la
// altura real de cada tema, para que al desmontar y volver nada salte.
const shownMemo = new Map<string, number>()
const heightMemo = new Map<string, number>()

/** Pistas que se van cargando solas al acercarse al final (scroll infinito). */
function Progressive({ list, hints, lang, memoKey }: { list: Cluster[]; hints: Map<number, Hint>; lang: Lang; memoKey: string }) {
  const [shown, setShown] = useState(() => shownMemo.get(memoKey) ?? FIRST)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    shownMemo.set(memoKey, shown)
  }, [memoKey, shown])
  useEffect(() => {
    const el = sentinel.current
    if (!el || shown >= list.length) return
    // solo al acercarse por abajo: cargar pistas por encima de la pantalla movería lo que estás leyendo
    const io = new IntersectionObserver(
      (e) => e[0].isIntersecting && e[0].boundingClientRect.top > 0 && setShown((n) => n + MORE),
      { rootMargin: '0px 0px 900px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, list.length])
  return (
    <>
      <div className="hints">
        {list.slice(0, shown).map((c) => <HintItem key={c.id} cluster={c} hints={hints} lang={lang} />)}
      </div>
      {shown < list.length && <div ref={sentinel} className="lib-sentinel">Cargando más…</div>}
    </>
  )
}

/**
 * Tema que solo monta su contenido cerca de la pantalla. Lejos, se desmonta y
 * deja un hueco con su altura real (o una estimación si nunca se ha visto).
 * La cabecera siempre está: el índice y los saltos la encuentran.
 */
function LazyTopic({ id, estimate, head, children }: { id: string; estimate: number; head: React.ReactNode; children: () => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true)
        else {
          if (el.offsetHeight > 0) heightMemo.set(id, el.offsetHeight)
          setNear(false)
        }
      },
      // asimétrico: lo de abajo se prepara con antelación; lo de arriba, solo muy cerca
      { rootMargin: '300px 0px 1500px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [id])
  return (
    <section className="lib-topic" id={id}>
      {head}
      <div ref={ref} className="lib-topic-body" style={near ? undefined : { height: heightMemo.get(id) ?? estimate }}>
        {near ? children() : null}
      </div>
    </section>
  )
}

function PartBlock({ topic, part, hints, lang, memo }: { topic: Topic; part: Part; hints: Map<number, Hint>; lang: Lang; memo: string }) {
  const [minor, setMinor] = useState(false)
  return (
    <div className="lib-part" id={subId(topic.cat, part.sub)}>
      {part.sub && <h3 className="sub-title">{SUBCATEGORY_LABEL[part.sub] ?? part.sub}</h3>}
      {part.hints.length > 0 && <Progressive list={part.hints} hints={hints} lang={lang} memoKey={`${memo}|${subId(topic.cat, part.sub)}`} />}
      {part.tiles.length > 0 && <PhotoTiles items={part.tiles} limit={part.hints.length ? 8 : 16} />}
      {part.minor.length > 0 && (
        <>
          <button className="link minor-toggle" onClick={() => setMinor(!minor)}>
            {minor ? 'Ocultar detalles menores' : `${part.minor.length} ${part.minor.length === 1 ? 'detalle menor' : 'detalles menores'}`}
          </button>
          {minor && <HintList list={part.minor} hints={hints} lang={lang} limit={30} step={30} />}
        </>
      )}
    </div>
  )
}

/** Diferencias entre los objetos principales de dos países (mismo tipo, rasgo distinto). */
function differences(mine: MetaObject[], theirs: MetaObject[], a: CountryRow, b: CountryRow) {
  const main = (list: MetaObject[]) => new Map(list.filter((o) => o.variant === 'main' && !o.region).map((o) => [o.type, o]))
  const ma = main(mine)
  const mb = main(theirs)
  const out: { what: string; mine: string; theirs: string }[] = []
  if (a.driving_side && b.driving_side && a.driving_side !== b.driving_side)
    out.push({ what: 'Conducción', mine: a.driving_side === 'left' ? 'izquierda' : 'derecha', theirs: b.driving_side === 'left' ? 'izquierda' : 'derecha' })
  for (const [type, oa] of ma) {
    const ob = mb.get(type)
    if (!ob) continue
    for (const [k, v] of Object.entries(oa.attrs)) {
      const w = ob.attrs[k]
      if (w && w !== v && v !== 'other' && w !== 'other')
        out.push({ what: `${OBJECT_LABEL[type]?.label ?? type} · ${attrLabel(k).toLowerCase()}`, mine: valueLabel(v), theirs: valueLabel(w) })
    }
  }
  return out
}

export default function CountryGuide() {
  const { code } = useParams()
  const g = useGuide(code)
  const lang = useLang()
  const objectsFile = useMetaObjects()
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<null | 'filtros' | 'region'>(null)
  const [regionQuery, setRegionQuery] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [allRegions, setAllRegions] = useState(false)
  const [mSearch, setMSearch] = useState(false)

  const f: Filters = Object.fromEntries(FKEYS.map((k) => [k, params.get(k) ?? undefined]).filter(([, v]) => v))
  const filtering = FKEYS.some((k) => f[k])
  const set = (k: FKey, v?: string, scroll = false) =>
    withTransition(() => {
      const next = new URLSearchParams(params)
      if (v) next.set(k, v)
      else next.delete(k)
      setParams(next, { replace: true })
      if (scroll) requestAnimationFrame(() => jump('biblioteca'))
    })
  const toggle = (k: FKey, v: string) => set(k, f[k] === v ? undefined : v)
  const clear = () => withTransition(() => setParams({}, { replace: true }))
  const focusOn = new Set(f.ver?.split(',') ?? [])
  const toggleFocus = (id: string) => {
    const next = new Set(focusOn)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set('ver', [...next].join(',') || undefined, true)
  }

  // búsqueda instantánea: filtra mientras escribes (con una pausa corta para no recalcular en cada tecla)
  const [draft, setDraft] = useState(f.q ?? '')
  useEffect(() => {
    if (draft.trim() !== (f.q ?? '')) setDraft(f.q ?? '')
  }, [f.q]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = draft.trim()
    if (v === (f.q ?? '')) return
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(params)
      if (v) next.set('q', v)
      else next.delete('q')
      const first = !f.q && v
      setParams(next, { replace: true })
      if (first) requestAnimationFrame(() => jump('biblioteca'))
    }, 220)
    return () => window.clearTimeout(t)
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sheet) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sheet])

  const haystack = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of g.all) {
      const h = g.hints.get(c.canonical_id)
      m.set(c.id, `${h ? hintText(h, lang) : ''} ${h?.title ?? ''} ${c.region ?? ''}`.toLowerCase())
    }
    return m
  }, [g.all, g.hints, lang])

  const passes = (c: Cluster, skip?: FKey) => {
    const needle = f.q?.trim().toLowerCase()
    if (skip !== 'q' && needle && !haystack.get(c.id)?.includes(needle)) return false
    if (skip !== 'ver' && f.ver && !focusOn.has(FOCUS_OF.get(c.category) ?? '')) return false
    if (skip !== 'region' && f.region && (f.region === NATIONAL ? c.region : c.region !== f.region)) return false
    if (skip !== 'imp' && f.imp && String(c.usefulness ?? 2) !== f.imp) return false
    if (skip !== 'foto' && f.foto && !g.imagesOf(c).length) return false
    if (skip !== 'multi' && f.multi && c.source_count < 2) return false
    if (skip !== 'fuente' && f.fuente && !c.sources.includes(f.fuente)) return false
    return true
  }
  const count = (skip: FKey, key: (c: Cluster) => string | string[] | null | undefined) => {
    const m = new Map<string, number>()
    for (const c of g.all) {
      if (!passes(c, skip)) continue
      const k = key(c)
      for (const v of Array.isArray(k) ? k : [k]) if (v) m.set(v, (m.get(v) ?? 0) + 1)
    }
    return m
  }

  const filtered = useMemo(() => g.all.filter((c) => passes(c)), [g.all, params.toString(), haystack]) // eslint-disable-line react-hooks/exhaustive-deps
  // con región o texto, los perfiles nacionales sobran: solo las pistas
  // con filtros, solo los temas que conservan alguna pista
  const topics = useMemo(
    () => (filtering ? g.buildTopics(filtered, !f.region && !f.q).filter((t) => t.n > 0) : g.topics),
    [filtered, g.topics, filtering], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const key = useMemo(() => recognise(g, 4), [g.text, g.hints]) // eslint-disable-line react-hooks/exhaustive-deps
  const country = g.country
  const twins = useMemo(() => {
    if (!country) return []
    return (country.confusable ?? []).slice(0, 2).flatMap((cc) => {
      const other = g.map.get(cc)
      if (!other) return []
      const theirs = (objectsFile?.objects ?? []).filter((o) => o.country === cc)
      const explained = g.objects.flatMap((o) => o.confusedWith.filter((w) => w.country === cc && w.difference).map((w) => w.difference!))
      return [{ other, explained, diffs: differences(g.objects, theirs, country, other).slice(0, 5) }]
    })
  }, [country, g.map, g.objects, objectsFile])

  // rutina de escaneo: por cada tema, la mejor foto de todo el país, su receta y la regla clave
  const scan = useMemo(() => {
    return SCAN.flatMap((x) => {
      const t = g.topics.find((y) => y.cat === x.cat)
      if (!t) return []
      const national = t.parts.flatMap((p) => p.hints).filter((c) => !c.region)
      const withImg = national.find((c) => g.imagesOf(c).length) ?? t.parts.flatMap((p) => p.hints).find((c) => g.imagesOf(c).length)
      const img = withImg ? g.imagesOf(withImg)[0] : t.cover
      const best = national[0]
      const seen = new Set<string>()
      const traits = g.objects
        .filter((o) => x.types.includes(o.type) && o.variant === 'main' && !o.region)
        .flatMap((o) =>
          Object.entries(o.attrs)
            .filter(([, v]) => !SKIP_VALUES.has(v))
            .map(([k, v]) => {
              const n = g.traitCount(o.type, k, v)
              return { k: `${o.type}.${k}.${v}`, label: attrLabel(k).toLowerCase(), v, rare: n !== undefined && n <= 3 }
            }),
        )
        .filter((t) => !seen.has(t.k) && seen.add(t.k))
        .slice(0, 6)
      const rule = best ? firstSentence(hintText(g.hints.get(best.canonical_id)!, lang), 150) : null
      if (!img && !traits.length && !rule) return []
      return [{ ...x, img, traits, rule, n: t.n, rare: traits.some((t) => t.rare) }]
    })
  }, [g.topics, g.objects, g.hints, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const ids = useMemo(() => [...(filtering ? [] : CHAPTERS.map((c) => c.id)), 'biblioteca', ...topics.map((t) => topicId(t.cat))], [topics, filtering])
  const active = useActive(ids)
  const activeCat = active.startsWith('t-') ? active.slice(2) : ''

  // el tema activo, siempre a la vista: centrado en la fila del móvil y dentro del índice lateral
  useEffect(() => {
    const chips = document.querySelector<HTMLElement>('.lib-mchips')
    const chip = chips?.querySelector<HTMLElement>('.on')
    if (chips && chip && chips.offsetParent) chips.scrollTo({ left: chip.offsetLeft - chips.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
    const toc = document.querySelector<HTMLElement>('.lib-toc')
    const item = toc?.querySelector<HTMLElement>('button.on')
    if (toc && item && toc.offsetParent) {
      const top = item.offsetTop - toc.offsetTop
      if (top < toc.scrollTop || top > toc.scrollTop + toc.clientHeight - 40) toc.scrollTo({ top: top - toc.clientHeight / 3, behavior: 'smooth' })
    }
  }, [active])

  if (g.loading) return <Loading what="la guía" />
  if (g.missing || !country || !g.file) return <MissingData />

  const name = country.name_es ?? country.name
  const sv = countryStreetView(country.code)
  const streetView =
    sv?.url ?? (country.lat != null ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${country.lat},${country.lng}` : null)
  const sources = new Set(g.all.flatMap((c) => c.sources)).size
  const regionalCount = g.text.filter((c) => c.region).length

  const regs = count('region', (c) => c.region ?? NATIONAL)
  const imps = count('imp', (c) => String(c.usefulness ?? 2))
  const fuentes = count('fuente', (c) => c.sources)
  const fotos = count('foto', (c) => (g.imagesOf(c).length ? 'y' : null)).get('y') ?? 0
  const multis = count('multi', (c) => (c.source_count > 1 ? 'y' : null)).get('y') ?? 0
  const regionList = [...regs.entries()].filter(([r]) => r !== NATIONAL).sort((a, b) => b[1] - a[1])
  const rq = regionQuery.trim().toLowerCase()
  const regionShown = rq ? regionList.filter(([r]) => r.toLowerCase().includes(rq)) : regionList
  const regionLabel = !f.region ? 'Región' : f.region === NATIONAL ? 'Todo el país' : f.region
  const moreActive = (['imp', 'foto', 'multi', 'fuente'] as FKey[]).filter((k) => f[k]).length
  const focusCount = count('ver', (c) => FOCUS_OF.get(c.category))

  const Opt = ({ k, v, label, n }: { k: FKey; v: string; label: string; n?: number }) => (
    <button className={`fx-opt ${f[k] === v ? 'on' : ''}`} onClick={() => toggle(k, v)} disabled={!n && f[k] !== v}>
      <span>{label}</span>
      <span className="fx-n">{n ?? 0}</span>
    </button>
  )

  const focusChips = FOCUS.filter((x) => focusCount.get(x.id) || focusOn.has(x.id)).map((x) => (
    <button key={x.id} className={`lib-focus ${focusOn.has(x.id) ? 'on' : ''}`} onClick={() => toggleFocus(x.id)}>
      {x.label} <span>{focusCount.get(x.id) ?? 0}</span>
    </button>
  ))
  const extra = (
    <>
      {regionList.length > 0 && <button className={`fx-pill ${f.region ? 'on' : ''}`} onClick={() => setSheet('region')}>{regionLabel}</button>}
      <button className={`fx-pill ${moreActive ? 'on' : ''}`} onClick={() => setSheet('filtros')}>Más filtros{moreActive ? ` · ${moreActive}` : ''}</button>
    </>
  )
  const searchInput = (autoFocus = false) => (
    <input
      autoFocus={autoFocus}
      className="input lib-search"
      type="search"
      placeholder={`Buscar en ${name}: «amarillo», «Texas»…`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && jump('biblioteca')}
    />
  )
  const search = searchInput()

  return (
    <div className="cg">
      <nav className="crumbs"><Link to="/paises">Países</Link> / {name}</nav>

      {/* ── héroe ── */}
      <header className={`cg-hero ${g.file.summaryImage ? '' : 'no-summary'}`}>
        <div className="cg-hero-text">
          <div className="guide-name">
            <span className="flag">{country.flag}</span>
            <h1>{name}</h1>
          </div>
          <p className="lead">Aprende a reconocer {name} en segundos, a no confundirlo con sus gemelos y a saber en qué parte estás.</p>
          <div className="cg-stats">
            <div><strong>{g.all.length.toLocaleString('es')}</strong><span>pistas</span></div>
            <div><strong>{country.essential}</strong><span>determinantes</span></div>
            {g.regions.length > 0 && <div><strong>{g.regions.length}</strong><span>regiones</span></div>}
            <div><strong>{sources}</strong><span>fuentes</span></div>
          </div>
          <div className="row">
            <Link to={`/entrenar?pais=${country.code}`} className="btn btn-primary">Entrenar {name}</Link>
            <button className="btn" onClick={() => jump('reconocer')}>Empezar por lo esencial</button>
            {streetView && <a href={streetView} target="_blank" rel="noreferrer" className="btn btn-quiet">Street View</a>}
          </div>
          <div className="cg-facts">
            <span><em>Conduce</em> por la {country.driving_side === 'left' ? 'izquierda' : 'derecha'}</span>
            {country.languages.length > 0 && <span><em>Idioma</em> {country.languages.slice(0, 3).join(', ')}</span>}
            {country.tlds.length > 0 && <span><em>Dominio</em> {country.tlds.join(' ')}</span>}
            {country.calling_codes.length > 0 && <span><em>Prefijo</em> {country.calling_codes.slice(0, 2).join(' ')}</span>}
          </div>
        </div>
        {g.file.summaryImage && (
          <button className="shot cg-summary" onClick={() => setShowSummary(true)} aria-label="Ampliar ficha resumen">
            <img src={imageSrc(g.file.summaryImage)} alt={`Ficha resumen de ${name}`} />
          </button>
        )}
      </header>

      {/* ── barra del móvil: enfoques a un toque y, debajo, el índice que sigue el scroll ── */}
      <div className="lib-mbar">
        <div className="lib-mrow">
          <button className={`lib-focus lib-lupa ${mSearch || f.q ? 'on' : ''}`} onClick={() => setMSearch(!mSearch)} aria-label="Buscar">Buscar</button>
          {focusChips}
          {extra}
        </div>
        {(mSearch || f.q) && <div className="lib-msearch">{searchInput(mSearch && !f.q)}</div>}
        <div className="lib-mchips">
          {!filtering && CHAPTERS.map((c) => (
            <button key={c.id} className={active === c.id ? 'on' : ''} onClick={() => jump(c.id)}>{c.n} · {c.label}</button>
          ))}
          {topics.map((t) => (
            <button key={t.cat} className={activeCat === t.cat ? 'on' : ''} onClick={() => jump(topicId(t.cat))}>
              {g.catName(t.cat)} <span>{t.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lib">
        {/* ── índice lateral (escritorio) ── */}
        <aside className="lib-side">
          {search}
          <div className="lib-focusgrid">{focusChips}</div>
          <div className="lib-quick">{extra}</div>
          {filtering && (
            <div className="lib-active">
              <strong>{filtered.length.toLocaleString('es')}</strong> pistas coinciden
              <button className="link" onClick={clear}>Quitar filtros</button>
            </div>
          )}
          <nav className="lib-toc">
            {!filtering && (
              <>
                <span className="eyebrow">Guía</span>
                {CHAPTERS.map((c) => (
                  <button key={c.id} className={active === c.id ? 'on' : ''} onClick={() => jump(c.id)}>
                    <span className="num">{c.n}</span>{c.label}
                  </button>
                ))}
              </>
            )}
            <span className="eyebrow">Biblioteca</span>
            {topics.map((t) => (
              <div key={t.cat} className="lib-toc-topic">
                <button className={activeCat === t.cat ? 'on' : ''} onClick={() => jump(topicId(t.cat))}>
                  <span>{g.catName(t.cat)}</span><span className="fx-n">{t.n}</span>
                </button>
                {activeCat === t.cat && t.parts.filter((p) => p.sub).length > 1 && (
                  <div className="lib-toc-subs">
                    {t.parts.filter((p) => p.sub).map((p) => (
                      <button key={p.sub} onClick={() => jump(subId(t.cat, p.sub))}>{SUBCATEGORY_LABEL[p.sub!] ?? p.sub}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        <div className="lib-main">
          {!filtering && (
            <>
              {/* ── 1 · reconócelo ── */}
              <section className="cg-chapter" id="reconocer">
                <header className="cg-chapter-head">
                  <span className="cg-num">1</span>
                  <div>
                    <h2>Reconócelo en 5 segundos</h2>
                    <p>Lo que te dice «estás en {name}» en cualquier parte del país.</p>
                  </div>
                </header>
                {key.length ? (
                  <div className="rcards">
                    {key.map((c) => {
                      const img = g.imagesOf(c)[0]
                      return (
                        <button key={c.id} className="rcard" onClick={() => jump(topicId(c.category))}>
                          <div className="rcard-img">{img ? <img src={imageSrc(img, 'thumb')} alt="" loading="lazy" /> : <span>{g.catName(c.category)}</span>}</div>
                          <div className="rcard-body">
                            <span className="eyebrow">{g.catName(c.category)}</span>
                            <p>{firstSentence(hintText(g.hints.get(c.canonical_id)!, lang))}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="muted">Aún no hay pistas determinantes para todo el país.</p>
                )}
                {twins.length > 0 && (
                  <div className="twin-strip">
                    <span>¿Lo confundes?</span>
                    {twins.map(({ other }) => (
                      <Link key={other.code} to={`/duelo?a=${country.code}&b=${other.code}`} className="chip">
                        Duelo con {other.flag} {other.name_es ?? other.name}
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              {/* ── 2 · memoriza su meta: la rutina de escaneo ── */}
              {scan.length > 0 && (
                <section className="cg-chapter" id="meta">
                  <header className="cg-chapter-head">
                    <span className="cg-num">2</span>
                    <div>
                      <h2>Memoriza su meta</h2>
                      <p>Recorre la imagen en este orden. Son las {scan.length} cosas que más te dicen «esto es {name}».</p>
                    </div>
                  </header>
                  <ol className="scan">
                    {scan.map((x, i) => (
                      <li key={x.cat} className="scan-item">
                        <button className="scan-card" onClick={() => jump(topicId(x.cat))}>
                          <div className="scan-img">
                            {x.img ? <img src={imageSrc(x.img, 'thumb')} alt="" loading="lazy" /> : null}
                            <span className="scan-step">{i + 1}</span>
                            {x.rare && <span className="scan-rare">rasgo raro</span>}
                          </div>
                          <div className="scan-body">
                            <span className="eyebrow">{x.look}</span>
                            <h3>{g.catName(x.cat)}</h3>
                            {x.traits.length > 0 && (
                              <ul className="scan-traits">
                                {x.traits.map((t) => (
                                  <li key={t.k} className={t.rare ? 'rare' : ''}>
                                    {COLOR_HEX[t.v] && <span className="swatch" style={{ background: COLOR_HEX[t.v] }} />}
                                    <em>{t.label}</em> {valueLabel(t.v)}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {x.rule && <p>{x.rule}</p>}
                            <span className="scan-more">Todo sobre {g.catName(x.cat).toLowerCase()} · {x.n} →</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* ── 3 · ubícate ── */}
              <section className="cg-chapter" id="ubicate">
                <header className="cg-chapter-head">
                  <span className="cg-num">3</span>
                  <div>
                    <h2>Ubícate dentro del país</h2>
                    <p>
                      {g.regions.length
                        ? `${regionalCount} pistas en ${g.regions.length} regiones. Elige una y la guía entera se filtra por ella.`
                        : `No hay pistas regionales para ${name}: sus pistas valen para todo el país.`}
                    </p>
                  </div>
                </header>
                <div className="cg-terrain">
                  <h3>Relieve, terreno, cultivos y clima</h3>
                  {code && <CountryTerrain cc={code} />}
                </div>
                {g.regions.length > 0 && (
                  <>
                    <div className="regions">
                      {g.regions.slice(0, allRegions ? undefined : 12).map(([region, list]) => {
                        const h = g.hints.get(list[0].canonical_id)
                        return (
                          <button key={region} className="region" onClick={() => set('region', region, true)}>
                            <div className="region-head"><strong>{region}</strong><span>{list.length}</span></div>
                            {h && <p>{firstSentence(hintText(h, lang), 120)}</p>}
                          </button>
                        )
                      })}
                    </div>
                    {g.regions.length > 12 && !allRegions && (
                      <button className="link region-more" onClick={() => setAllRegions(true)}>Ver las {g.regions.length - 12} regiones restantes</button>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {/* ── biblioteca: todo, tema por tema ── */}
          <section className="lib-books" id="biblioteca">
            <header className="cg-chapter-head lib-head">
              {!filtering && <span className="cg-num">4</span>}
              <div>
                <h2>{filtering ? `${filtered.length.toLocaleString('es')} pistas` : 'Toda la guía, tema por tema'}</h2>
                <p>
                  {filtering ? (
                    <span className="lib-chips">
                      {f.q && <button className="fx-chip" onClick={() => set('q')}>«{f.q}» <span>×</span></button>}
                      {FOCUS.filter((x) => focusOn.has(x.id)).map((x) => (
                        <button key={x.id} className="fx-chip" onClick={() => toggleFocus(x.id)}>{x.label} <span>×</span></button>
                      ))}
                      {f.region && <button className="fx-chip" onClick={() => set('region')}>{regionLabel} <span>×</span></button>}
                      {f.imp && <button className="fx-chip" onClick={() => set('imp')}>{USEFULNESS[Number(f.imp)]?.label} <span>×</span></button>}
                      {f.foto && <button className="fx-chip" onClick={() => set('foto')}>Con foto <span>×</span></button>}
                      {f.multi && <button className="fx-chip" onClick={() => set('multi')}>Varias fuentes <span>×</span></button>}
                      {f.fuente && <button className="fx-chip" onClick={() => set('fuente')}>{SOURCE_NAMES[f.fuente] ?? f.fuente} <span>×</span></button>}
                      <button className="link" onClick={clear}>Quitar filtros</button>
                    </span>
                  ) : (
                    `Las ${g.all.length.toLocaleString('es')} pistas de ${name}. Usa el índice para saltar a un tema o los filtros para afinar.`
                  )}
                </p>
              </div>
            </header>

            {topics.length === 0 && <p className="muted">Nada coincide con estos filtros.</p>}
            {topics.map((t) => {
              const main = mainObjects(t)
              const variants = variantObjects(t)
              const memo = `${country.code}?${params.toString()}`
              // estimación de altura mientras no se ha visto: pistas iniciales, fotos y perfil
              const estimate =
                t.parts.reduce((s, p) => s + Math.min(p.hints.length, FIRST) * 330 + Math.ceil(Math.min(p.tiles.length, 16) / 5) * 200 + (p.sub ? 40 : 0), 0) +
                main.length * 160 + (t.facts.length ? 60 : 0) + (variants.length ? 40 : 0)
              return (
                <LazyTopic
                  key={`${t.cat}|${memo}`}
                  id={topicId(t.cat)}
                  estimate={estimate}
                  head={
                    <header className="lib-topic-head">
                      <h2>{g.catName(t.cat)}</h2>
                      <span className="muted">{t.n} {t.n === 1 ? 'pista' : 'pistas'}{t.essential ? ` · ${t.essential} determinantes` : ''}</span>
                      {TOPIC_MAP_LAYER[t.cat] && <Link className="lib-map" to={`/mapas?capa=${TOPIC_MAP_LAYER[t.cat]}`}>Ver en el mapa mundial →</Link>}
                    </header>
                  }
                >
                  {() => (
                    <>
                      {main.length > 0 && (
                        <div className="profiles">{main.map((o) => <ObjectProfile key={o.id} obj={o} map={g.map} traitCount={g.traitCount} />)}</div>
                      )}
                      {t.facts.length > 0 && (
                        <dl className="topic-facts">
                          {t.facts.map(([title, vals]) => <div key={title}><dt>{title}</dt><dd>{vals.join(' · ')}</dd></div>)}
                        </dl>
                      )}
                      {t.parts.map((p) => <PartBlock key={p.sub ?? ''} topic={t} part={p} hints={g.hints} lang={lang} memo={memo} />)}
                      {variants.length > 0 && <Variants list={variants} />}
                    </>
                  )}
                </LazyTopic>
              )
            })}
          </section>

          {!filtering && g.file.resources.length > 0 && (
            <section className="cg-chapter" id="recursos">
              <header className="cg-chapter-head"><div><h2>Recursos</h2></div></header>
              <div className="resources">
                {(['practice_map', 'community_doc', 'other'] as const).map((kind) => {
                  const list = g.file!.resources.filter((r) => r.kind === kind)
                  if (!list.length) return null
                  return (
                    <div key={kind} className="sub">
                      <h3 className="sub-title">{kind === 'practice_map' ? 'Mapas para practicar' : kind === 'community_doc' ? 'Guías de la comunidad' : 'Otros enlaces'}</h3>
                      <ul className="resource-list">
                        {list.map((r) => (
                          <li key={r.url}>
                            <a href={r.url} target="_blank" rel="noreferrer">{r.title ?? r.url}</a>
                            {(r.note || r.author) && <span className="muted">{r.note ?? `por ${r.author}`}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── hojas: región y más filtros ── */}
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong>{sheet === 'region' ? 'Región' : 'Filtros'}</strong>
              <button className="btn btn-quiet" onClick={() => setSheet(null)} aria-label="Cerrar">✕</button>
            </div>
            <div className="sheet-body">
              {sheet === 'region' ? (
                <div className="fx-group">
                  <Opt k="region" v={NATIONAL} label="Todo el país (pistas nacionales)" n={regs.get(NATIONAL)} />
                  <input className="input fx-mini" placeholder="Buscar región" value={regionQuery} onChange={(e) => setRegionQuery(e.target.value)} />
                  {regionShown.map(([r, n]) => <Opt key={r} k="region" v={r} label={r} n={n} />)}
                </div>
              ) : (
                <>
                  <div className="fx-group">
                    <span className="eyebrow">Importancia</span>
                    <div className="fx-seg">
                      {[3, 2, 1].map((u) => (
                        <button key={u} className={f.imp === String(u) ? 'on' : ''} onClick={() => toggle('imp', String(u))} disabled={!imps.get(String(u)) && f.imp !== String(u)}>
                          {USEFULNESS[u].label}<span>{imps.get(String(u)) ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="fx-group">
                    <span className="eyebrow">Mostrar</span>
                    <Opt k="foto" v="1" label="Solo con foto" n={fotos} />
                    <Opt k="multi" v="1" label="Confirmadas por varias fuentes" n={multis} />
                  </div>
                  {regionList.length > 0 && (
                    <div className="fx-group">
                      <span className="eyebrow">Región</span>
                      <button className="fx-opt" onClick={() => setSheet('region')}><span>{regionLabel}</span><span className="fx-n">elegir →</span></button>
                    </div>
                  )}
                  <div className="fx-group">
                    <span className="eyebrow">Fuente</span>
                    {[...fuentes.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => <Opt key={s} k="fuente" v={s} label={SOURCE_NAMES[s] ?? s} n={n} />)}
                  </div>
                </>
              )}
            </div>
            <div className="sheet-foot">
              <button className="btn btn-primary" onClick={() => { setSheet(null); jump('biblioteca') }}>Ver {filtered.length.toLocaleString('es')} pistas</button>
            </div>
          </div>
        </div>
      )}

      {showSummary && g.file.summaryImage && (
        <Lightbox images={[g.file.summaryImage]} index={0} onClose={() => setShowSummary(false)} caption={<span>Ficha resumen · Plonk It</span>} />
      )}
    </div>
  )
}
