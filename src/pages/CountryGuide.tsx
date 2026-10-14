import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type Cluster, type Hint, type MetaObject, useCountryFile, useCountryMap, useMeta, useMetaObjects } from '../lib/data'
import { hintText, useLang } from '../lib/i18n'
import { OBJECT_CATEGORY, OBJECT_LABEL, SUBCATEGORY_LABEL, VARIANT_LABEL, valueLabel } from '../lib/labels'
import { countryStreetView } from '../data/capitals'
import { CountryChip, HintItem, Lightbox, Loading, MissingData, ObjectProfile, PhotoTiles } from '../components/ui'
import { imageSrc } from '../lib/images'

// Orden de los temas: primero la meta que más decide (coche, bolardos, líneas…).
const TOPIC_ORDER = [
  'google_car', 'camera', 'coverage', 'bollards', 'road_lines', 'plates', 'poles', 'signs', 'guardrails',
  'road_numbering', 'milestones', 'road_surface', 'language', 'naming', 'phone', 'architecture',
  'street_furniture', 'vehicles', 'culture', 'landscape', 'landmarks', 'sun', 'general', 'regions',
  'driving_side', 'domain', 'flag', 'currency', 'other',
]
const ATTR_TOPIC: Record<string, { cat: string; title: string }> = {
  cameraGens: { cat: 'camera', title: 'Generaciones de cámara' },
  years: { cat: 'coverage', title: 'Años de cobertura' },
  snow: { cat: 'coverage', title: 'Nieve en la cobertura' },
}
const FACT_VALUE: Record<string, string> = { Outdoor: 'sí, en exteriores', Indoor: 'solo en interiores' }
const PER_TOPIC = 5 // pistas visibles por tema antes de "ver más"
const topicId = (cat: string) => `t-${cat}`

// a igual utilidad, lo que vale para todo el país va antes que lo regional
const byImportance = (a: Cluster, b: Cluster) =>
  (b.usefulness ?? 0) - (a.usefulness ?? 0) || (a.region ? 1 : 0) - (b.region ? 1 : 0) ||
  b.source_count - a.source_count || b.size - a.size

/** Con HashRouter, un href="#seccion" cambiaría de ruta: se desplaza a mano. */
function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type Tile = { image: string; caption?: string | null }
type Part = { sub: string | null; hints: Cluster[]; minor: Cluster[]; tiles: Tile[] }
type Topic = { cat: string; parts: Part[]; objects: MetaObject[]; facts: [string, string[]][]; n: number }

function HintList({ list, hints, lang, limit = PER_TOPIC, topicOf }: {
  list: Cluster[]
  hints: Map<number, Hint>
  lang: 'es' | 'en'
  limit?: number
  topicOf?: (c: Cluster) => { label: string; onClick: () => void }
}) {
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, limit)
  return (
    <>
      <div className="hints">
        {shown.map((c) => (
          <HintItem key={c.id} cluster={c} hints={hints} lang={lang} topic={topicOf?.(c)} />
        ))}
      </div>
      {list.length > limit && (
        <button className="btn more" onClick={() => setAll(!all)}>
          {all ? 'Ver menos' : `Ver ${list.length - limit} más`}
        </button>
      )}
    </>
  )
}

// Con pocos objetos se muestran todos como perfil; con muchos (matrículas por
// estado) solo los generales arriba y las variantes en una lista plegada.
const MAX_PROFILES = 3
const isMain = (o: MetaObject) => o.variant === 'main' && !o.region
const mainObjects = (t: Topic) => (t.objects.length <= MAX_PROFILES ? t.objects : t.objects.filter(isMain))
const variantObjects = (t: Topic) => (t.objects.length <= MAX_PROFILES ? [] : t.objects.filter((o) => !isMain(o)))

function Variants({ list }: { list: MetaObject[] }) {
  const [open, setOpen] = useState(false)
  const label = OBJECT_LABEL[list[0].type]?.label.toLowerCase() ?? ''
  return (
    <div className="sub">
      <button className="link minor-toggle" onClick={() => setOpen(!open)}>
        {open ? 'Ocultar variantes' : `${list.length} variantes de ${label} (por región, antiguas o especiales)`}
      </button>
      {open && (
        <dl className="variants">
          {list.map((o) => (
            <div key={o.id}>
              <dt>{o.region ?? VARIANT_LABEL[o.variant]}{o.region && o.variant !== 'main' && o.variant !== 'regional' ? ` · ${VARIANT_LABEL[o.variant]}` : ''}</dt>
              <dd>{[...Object.values(o.attrs).map(valueLabel), ...o.features].join(' · ')}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Pistas útiles a la vista; los detalles menores, plegados. */
function PartView({ part, hints, lang }: { part: Part; hints: Map<number, Hint>; lang: 'es' | 'en' }) {
  const [minor, setMinor] = useState(false)
  return (
    <div className="sub">
      {part.sub && <h3 className="sub-title">{SUBCATEGORY_LABEL[part.sub] ?? part.sub}</h3>}
      {part.hints.length > 0 && <HintList list={part.hints} hints={hints} lang={lang} />}
      {part.tiles.length > 0 && <PhotoTiles items={part.tiles} limit={part.hints.length ? 8 : 12} />}
      {part.minor.length > 0 && (
        <>
          <button className="link minor-toggle" onClick={() => setMinor(!minor)}>
            {minor ? 'Ocultar detalles menores' : `${part.minor.length} ${part.minor.length === 1 ? 'detalle menor' : 'detalles menores'}`}
          </button>
          {minor && <HintList list={part.minor} hints={hints} lang={lang} limit={50} />}
        </>
      )}
    </div>
  )
}

export default function CountryGuide() {
  const { code } = useParams()
  const file = useCountryFile(code)
  const map = useCountryMap()
  const meta = useMeta()
  const objectsFile = useMetaObjects()
  const lang = useLang()
  const [q, setQ] = useState('')
  const [showSummary, setShowSummary] = useState(false)

  const country = code ? map.get(code) : undefined
  const catName = (id: string) => meta?.categories.find((c) => c.id === id)?.name ?? id

  const hints = useMemo(() => new Map((file?.hints ?? []).map((h) => [h.id, h])), [file])
  const traitCount = useMemo(() => {
    const m = new Map((objectsFile?.traits ?? []).map((t) => [`${t.type}|${t.key}|${t.value}`, t.n]))
    return (type: string, key: string, value: string) => m.get(`${type}|${key}|${value}`)
  }, [objectsFile])

  const view = useMemo(() => {
    const textOf = (c: Cluster) => (hints.get(c.canonical_id)?.text ?? '').trim()
    // foto con nombre de GeoHints (marca, variante): se muestra como foto con pie, no como texto
    const asTile = (c: Cluster) => {
      const h = hints.get(c.canonical_id)
      if (!h || !(c.images?.length ?? h.images.length)) return false
      return !textOf(c) || (c.size === 1 && h.source_id === 'geohints' && textOf(c).length < 60)
    }

    const topics = new Map<string, Topic>()
    const topic = (cat: string) => {
      if (!topics.has(cat)) topics.set(cat, { cat, parts: [], objects: [], facts: [], n: 0 })
      return topics.get(cat)!
    }
    const part = (cat: string, sub: string | null) => {
      const t = topic(cat)
      let p = t.parts.find((x) => x.sub === sub)
      if (!p) t.parts.push((p = { sub, hints: [], minor: [], tiles: [] }))
      return p
    }

    const textClusters: Cluster[] = []
    for (const c of file?.clusters ?? []) {
      const sub = c.subcategory && SUBCATEGORY_LABEL[c.subcategory] ? c.subcategory : null
      if (asTile(c)) {
        const h = hints.get(c.canonical_id)!
        const caption = textOf(c) ? h.title ?? textOf(c) : null
        const imgs = (c.images ?? h.images).filter((u) => u !== file?.summaryImage)
        part(c.category, sub).tiles.push(...imgs.map((image) => ({ image, caption })))
        topic(c.category).n += imgs.length ? 1 : 0
        continue
      }
      if (!textOf(c)) continue
      textClusters.push(c)
      const p = part(c.category, sub)
      ;(c.usefulness === 1 ? p.minor : p.hints).push(c)
      topic(c.category).n++
    }
    textClusters.sort(byImportance)

    for (const o of objectsFile?.objects ?? []) {
      if (o.country !== code) continue
      topic(OBJECT_CATEGORY[o.type] ?? 'other').objects.push(o)
    }
    const facts = new Map<string, Set<string>>()
    for (const a of file?.attributes ?? []) {
      if (!ATTR_TOPIC[a.attribute]) continue
      if (!facts.has(a.attribute)) facts.set(a.attribute, new Set())
      facts.get(a.attribute)!.add(a.value)
    }
    for (const [k, vals] of facts) topic(ATTR_TOPIC[k].cat).facts.push([ATTR_TOPIC[k].title, [...vals].sort()])

    for (const t of topics.values()) {
      t.objects.sort((a, b) => (a.variant === 'main' ? 0 : 1) - (b.variant === 'main' ? 0 : 1) || a.type.localeCompare(b.type))
      for (const p of t.parts) {
        p.hints.sort(byImportance)
        p.minor.sort(byImportance)
      }
      // sin subtema primero; luego los subtemas más grandes
      const size = (p: Part) => p.hints.length + p.minor.length + p.tiles.length / 4
      t.parts.sort((a, b) => (a.sub ? 1 : 0) - (b.sub ? 1 : 0) || size(b) - size(a))
    }
    const rank = (cat: string) => (TOPIC_ORDER.indexOf(cat) + 1 || 99)
    const ordered = [...topics.values()]
      .filter((t) => t.n || t.objects.length || t.facts.length)
      .sort((a, b) => rank(a.cat) - rank(b.cat))

    const regions = new Map<string, Cluster[]>()
    for (const c of textClusters) {
      if (!c.region) continue
      if (!regions.has(c.region)) regions.set(c.region, [])
      regions.get(c.region)!.push(c)
    }

    const needle = q.trim().toLowerCase()
    const results = needle
      ? textClusters.filter((c) => `${hintText(hints.get(c.canonical_id)!, lang)} ${c.region ?? ''}`.toLowerCase().includes(needle))
      : []

    return {
      searching: Boolean(needle),
      results,
      essential: textClusters.filter((c) => c.usefulness === 3),
      topics: ordered,
      regions: [...regions.entries()].sort((a, b) => b[1].length - a[1].length),
    }
  }, [file, hints, objectsFile, code, q, lang])

  if (file === undefined || !map.size) return <Loading what="la guía" />
  if (file === null || !country) return <MissingData />

  const sv = countryStreetView(country.code)
  const streetView =
    sv?.url ??
    (country.lat != null ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${country.lat},${country.lng}` : null)
  const confusable = country.confusable ?? []
  const topicLink = (c: Cluster) => ({ label: catName(c.category), onClick: () => jump(topicId(c.category)) })

  const toc = [
    ...(view.essential.length ? [{ id: 'esencial', label: 'Lo esencial', n: view.essential.length }] : []),
    ...view.topics.map((t) => ({ id: topicId(t.cat), label: catName(t.cat), n: t.n })),
    ...(view.regions.length ? [{ id: 'regiones', label: 'Por región', n: view.regions.length }] : []),
    ...(file.resources.length ? [{ id: 'recursos', label: 'Recursos', n: file.resources.length }] : []),
  ]

  const search = (
    <input className="input" placeholder={`Buscar en ${country.name_es}`} value={q} onChange={(e) => setQ(e.target.value)} />
  )

  return (
    <div>
      <nav className="crumbs"><Link to="/paises">Países</Link> / {country.name_es}</nav>

      <header className={`guide-header ${file.summaryImage ? '' : 'no-summary'}`}>
        <div className="guide-intro">
          <div className="guide-name">
            <span className="flag">{country.flag}</span>
            <h1>{country.name_es ?? country.name}</h1>
          </div>
          <div className="facts">
            <div className="fact"><span>Conduce por la</span>{country.driving_side === 'left' ? 'izquierda' : country.driving_side === 'right' ? 'derecha' : '—'}</div>
            {country.languages.length > 0 && <div className="fact"><span>Idiomas</span>{country.languages.join(', ')}</div>}
            {country.tlds.length > 0 && <div className="fact"><span>Dominio</span>{country.tlds.join(' ')}</div>}
            {country.calling_codes.length > 0 && <div className="fact"><span>Prefijo</span>{country.calling_codes.slice(0, 2).join(' ')}</div>}
            {country.capital && <div className="fact"><span>Capital</span>{country.capital}</div>}
            {country.currencies.length > 0 && <div className="fact"><span>Moneda</span>{country.currencies.map((c) => c.name).join(', ')}</div>}
          </div>
          <div className="row">
            <Link to={`/entrenar?pais=${country.code}`} className="btn btn-primary">Entrenar {country.name_es}</Link>
            {confusable.length > 0 && (
              <Link to={`/comparar?c=${[country.code, ...confusable.slice(0, 2)].join(',')}`} className="btn">Comparar con sus gemelos</Link>
            )}
            {streetView && <a href={streetView} target="_blank" rel="noreferrer" className="btn btn-quiet">Abrir Street View</a>}
          </div>
          {confusable.length > 0 && (
            <div className="row">
              <span className="muted small">Se confunde con</span>
              {confusable.map((c) => <CountryChip key={c} code={c} map={map} />)}
            </div>
          )}
        </div>
        {file.summaryImage && (
          <figure className="summary">
            <button className="shot" onClick={() => setShowSummary(true)} aria-label="Ampliar ficha resumen">
              <img src={imageSrc(file.summaryImage)} alt={`Ficha resumen de ${country.name_es}`} />
            </button>
          </figure>
        )}
      </header>

      <div className="guide-body">
        <aside className="toc">
          <div className="toc-search">{search}</div>
          {toc.map((t) => (
            <a key={t.id} href={`#/pais/${country.code}`} onClick={(e) => { e.preventDefault(); setQ(''); setTimeout(() => jump(t.id)) }}>
              {t.label} <span>{t.n}</span>
            </a>
          ))}
        </aside>

        <div className="guide-content">
          <div className="toolbar mobile-tools">{search}</div>

          {view.searching ? (
            <section className="section">
              <div className="section-head"><h2>Resultados</h2><span className="muted">{view.results.length}</span></div>
              {view.results.length === 0 ? <p className="muted">Nada coincide con «{q}».</p> : (
                <HintList list={view.results} hints={hints} lang={lang} limit={20} topicOf={topicLink} />
              )}
            </section>
          ) : (
            <>
              {view.essential.length > 0 && (
                <section className="section" id="esencial">
                  <div className="section-head"><h2>Lo esencial</h2><span className="muted">{view.essential.length}</span></div>
                  <p className="section-intro">Si solo vas a recordar algo de {country.name_es}, que sea esto. Cada pista lleva a su tema completo.</p>
                  <HintList list={view.essential} hints={hints} lang={lang} limit={8} topicOf={topicLink} />
                </section>
              )}

              {view.topics.map((t) => (
                <section key={t.cat} className="section" id={topicId(t.cat)}>
                  <div className="section-head"><h2>{catName(t.cat)}</h2><span className="muted">{t.n || ''}</span></div>
                  {mainObjects(t).length > 0 && (
                    <div className="profiles">
                      {mainObjects(t).map((o) => <ObjectProfile key={o.id} obj={o} map={map} traitCount={traitCount} />)}
                    </div>
                  )}
                  {t.facts.length > 0 && (
                    <dl className="topic-facts">
                      {t.facts.map(([title, vals]) => (
                        <div key={title}><dt>{title}</dt><dd>{vals.map((v) => FACT_VALUE[v] ?? v).join(' · ')}</dd></div>
                      ))}
                    </dl>
                  )}
                  {t.parts.map((p) => <PartView key={p.sub ?? ''} part={p} hints={hints} lang={lang} />)}
                  {variantObjects(t).length > 0 && <Variants list={variantObjects(t)} />}
                </section>
              ))}

              {view.regions.length > 0 && (
                <section className="section" id="regiones">
                  <div className="section-head"><h2>Por región</h2><span className="muted">{view.regions.length}</span></div>
                  <p className="section-intro">Pistas para saber en qué parte de {country.name_es} estás.</p>
                  {view.regions.slice(0, 30).map(([region, list]) => (
                    <div key={region} className="sub">
                      <h3 className="sub-title">{region}</h3>
                      <HintList list={list} hints={hints} lang={lang} limit={2} topicOf={topicLink} />
                    </div>
                  ))}
                  {view.regions.length > 30 && <p className="muted small">Y {view.regions.length - 30} regiones más: búscalas por nombre.</p>}
                </section>
              )}

              {file.resources.length > 0 && (
                <section className="section" id="recursos">
                  <div className="section-head"><h2>Recursos</h2></div>
                  <div className="resources">
                    {(['practice_map', 'community_doc', 'other'] as const).map((kind) => {
                      const list = file.resources.filter((r) => r.kind === kind)
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
            </>
          )}
        </div>
      </div>

      {showSummary && file.summaryImage && (
        <Lightbox images={[file.summaryImage]} index={0} onClose={() => setShowSummary(false)} caption={<span>Ficha resumen · Plonk It</span>} />
      )}
    </div>
  )
}
