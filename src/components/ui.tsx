import { createContext, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { Cluster, CountryRow, Hint, MetaObject } from '../lib/data'
import { countryFlag, countryLabel, useCountryFile, useCountryMap } from '../lib/data'
import { hintText, type Lang } from '../lib/i18n'
import { fetchPlaceWiki, type PlaceWiki } from '../lib/wiki'
import { COLOR_HEX, OBJECT_LABEL, SOURCE_NAMES, USEFULNESS, VARIANT_LABEL, attrLabel, valueLabel } from '../lib/labels'
import { geo, useGeo } from '../lib/geo'
import { entityMetrics, kindCount, kindLabel } from '../lib/geoFormat'
import { Img } from './Img'
import { SaveButton } from './study/SaveButton'
import { hintItem, placeItem } from '../lib/study/items'
import { useStudy } from '../lib/study/store'
import { retrievability } from '../lib/study/fsrs'
import { useDragToClose } from '../lib/gestures'

export function CountryChip({ code, map, to }: { code: string; map: Map<string, CountryRow>; to?: string }) {
  return (
    <Link to={to ?? `/pais/${code}`} className="chip">
      {countryFlag(map, code)} {countryLabel(map, code)}
    </Link>
  )
}

export function Usefulness({ value }: { value: number | null }) {
  if (!value || !USEFULNESS[value]) return null
  return <span className={`use use-${value}`} title={USEFULNESS[value].help}>{USEFULNESS[value].label}</span>
}

export function Swatch({ value }: { value: string }) {
  const hex = COLOR_HEX[value]
  return hex ? <span className="swatch" style={{ background: hex }} /> : null
}

/** Rareza de un rasgo según cuántos países lo tienen. */
export function rarityText(n: number | undefined): { text: string; cls: string } | null {
  if (!n) return null
  if (n === 1) return { text: 'exclusivo', cls: 'rarity rarity-1' }
  if (n <= 3) return { text: `${n} países`, cls: 'rarity rarity-1' }
  return { text: `${n} países`, cls: 'rarity' }
}

export function MissingData() {
  return (
    <div className="empty">
      Todavía no hay datos exportados. Ejecuta <code>npm run pipeline</code> y recarga.
    </div>
  )
}

/** Hora local a la que se reinicia la cuota diaria de D1 (medianoche UTC). */
function quotaReset(): string {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return next.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

/** Aviso cuando la API no responde, con el motivo en claro y un botón para reintentar. */
export function DataError({ error, what = 'los datos' }: { error: string; what?: string }) {
  const quota = /cuota/i.test(error)
  return (
    <div className="empty data-error">
      <p>
        {quota
          ? `Se agotó el límite diario de consultas de la base y ${what} no se pueden cargar ahora. Vuelve a partir de las ${quotaReset()}.`
          : `No se pudo cargar ${what}: ${error}`}
      </p>
      <button className="btn" onClick={() => window.location.reload()}>Reintentar</button>
    </div>
  )
}

export function Loading({ what = 'datos' }: { what?: string }) {
  return <div className="empty">Cargando {what}…</div>
}

// el visor de fotos (con gestos) vive en su propio archivo
export { Lightbox } from './Lightbox'
import { Lightbox } from './Lightbox'

/** Una imagen que no carga (enlace roto, límite de peticiones) no deja un recuadro vacío. */
function hideBroken(e: React.SyntheticEvent<HTMLImageElement>, box = '.shot') {
  const el = e.currentTarget.closest(box) as HTMLElement | null
  if (el) el.style.display = 'none'
}

/**
 * Rejilla de imágenes completas (sin recortar) que abre el visor. Con `strip`
 * cada imagen conserva su proporción a una altura fija: sin franjas vacías.
 */
export function Gallery({ images, limit = 12, min, strip }: { images: string[]; limit?: number; min?: number; strip?: boolean }) {
  const [box, setBox] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  if (!images.length) return null
  const shown = all ? images : images.slice(0, limit)
  return (
    <>
      <div
        className={strip ? (images.length === 1 ? 'strip strip-one' : 'strip') : 'gallery'}
        style={min && !strip ? { gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` } : undefined}
      >
        {shown.map((src, i) => (
          <button key={src} className="shot" onClick={() => setBox(i)} aria-label="Ampliar imagen">
            <Img src={src} size={strip && images.length === 1 ? 'img' : 'thumb'} onError={hideBroken} />
          </button>
        ))}
        {!all && images.length > limit && (
          <button className="shot shot-more" onClick={() => setAll(true)}>+{images.length - limit} más</button>
        )}
      </div>
      {box !== null && <Lightbox images={images} index={box} onClose={() => setBox(null)} />}
    </>
  )
}

type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] }
const BULLET = /^\s*[•▪●◦·*–-]\s+/

/** Líneas → párrafos y listas: las líneas con viñeta seguidas forman una lista. */
function blocks(s: string): Block[] {
  const out: Block[] = []
  for (const raw of s.split(/\n+/)) {
    const line = raw.trim()
    if (!line || /^[-–—_=*·•\s]+$/.test(line)) continue // separadores sueltos
    if (BULLET.test(line)) {
      const last = out[out.length - 1]
      const item = line.replace(BULLET, '')
      if (last?.kind === 'ul') last.items.push(item)
      else out.push({ kind: 'ul', items: [item] })
    } else out.push({ kind: 'p', text: line })
  }
  // una lista de un solo elemento se lee mejor como párrafo
  return out.map((b) => (b.kind === 'ul' && b.items.length === 1 ? { kind: 'p', text: b.items[0] } : b))
}

type Linker = (text: string) => React.ReactNode

function Blocks({ list, link = (t) => t }: { list: Block[]; link?: Linker }) {
  return (
    <>
      {list.map((b, i) =>
        b.kind === 'p' ? <p key={i}>{link(b.text)}</p> : <ul key={i}>{b.items.map((t, j) => <li key={j}>{link(t)}</li>)}</ul>,
      )}
    </>
  )
}

// palabras genéricas que se quitan para reconocer el nombre propio en cualquier idioma
// ("Cofre de Perote national park" → "Cofre de Perote", que también está en "parque nacional Cofre de Perote")
const PLACE_GENERIC = /\b(national park|nature reserve|state park|park|volcano|mount|mountains?|range|river|lake|island|islands|peninsula|desert|town of|village of|city of|town|village|city|state|province|region|county|district|municipality|highway|road)\b/gi
const placeCore = (n: string) => n.replace(PLACE_GENERIC, ' ').replace(/\s+/g, ' ').trim()
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Convierte en enlace (abre el mapa) cada lugar que aparece en el texto. */
function placeLinker(places: { n: string; es?: string }[], onPlace: (i: number) => void): Linker | undefined {
  // se reconoce el nombre original (inglés) y el español: el texto puede estar en cualquiera
  const forms: [string, number][] = []
  places.forEach((p, i) => {
    for (const f of new Set([p.n, placeCore(p.n), ...(p.es ? [p.es, placeCore(p.es)] : [])])) if (f.length >= 3) forms.push([f, i])
  })
  if (!forms.length) return undefined
  forms.sort((a, b) => b[0].length - a[0].length)
  const index = new Map(forms.map(([f, i]) => [f.toLowerCase(), i]))
  const re = new RegExp(`(?<![\\p{L}])(${forms.map(([f]) => escapeRe(f)).join('|')})(?![\\p{L}])`, 'giu')
  return (text) => {
    // cada lugar se enlaza solo la primera vez que aparece en el párrafo
    const used = new Set<number>()
    const out: React.ReactNode[] = []
    let last = 0
    for (const m of text.matchAll(re)) {
      const i = index.get(m[1].toLowerCase())
      if (i === undefined || used.has(i)) continue
      used.add(i)
      out.push(text.slice(last, m.index))
      out.push(
        <button key={`${m.index}`} className="place-link" onClick={() => onPlace(i)} title="Ver en el mapa">{m[1]}</button>,
      )
      last = m.index + m[1].length
    }
    out.push(text.slice(last))
    return out
  }
}

/**
 * Texto de una pista con su estructura: viñetas como lista, sin líneas en
 * blanco ni separadores, y la parte "--- NOTE:" (Learnable Meta) como nota.
 */
export function HintText({ text, places, onPlace }: { text: string; places?: { n: string; es?: string }[]; onPlace?: (i: number) => void }) {
  const link = places?.length && onPlace ? placeLinker(places, onPlace) : undefined
  // "--- NOTE:" (Learnable Meta) o "NOTA:" al inicio de línea (Geometas)
  const [main, ...notes] = text.split(/\s*-{2,}\s*(?:NOTE|NOTA|Note|Nota)\s*:?\s*|\n\s*(?:NOTE|NOTA|Note|Nota)\s*:\s*/)
  const note = blocks(notes.join('\n'))
  return (
    <div className="hint-text">
      <Blocks list={blocks(main)} link={link} />
      {note.length > 0 && (
        <div className="hint-note">
          <span>Nota</span>
          <div><Blocks list={note} link={link} /></div>
        </div>
      )}
    </div>
  )
}

/** Fotos con pie (marcas, variantes de matrícula…): imagen completa y su nombre debajo. */
export function PhotoTiles({ items, limit = 12 }: { items: { image: string; caption?: string | null; sv?: Hint['sv']; source?: string; url?: string | null }[]; limit?: number }) {
  const [box, setBox] = useState<number | null>(null)
  const [svAt, setSvAt] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  if (!items.length) return null
  const shown = all ? items : items.slice(0, limit)
  return (
    <>
      <div className="tiles">
        {shown.map((it, i) => (
          <figure key={it.image} className="tile">
            <button className="shot" onClick={() => setBox(i)} aria-label="Ampliar imagen">
              <Img src={it.image} alt={it.caption ?? ''} onError={(e) => hideBroken(e, '.tile')} />
            </button>
            {it.sv && (
              <button className="tile-sv" onClick={() => setSvAt(i)} aria-label="Ver en Street View">
                <span className="sv-dot" />Street View
              </button>
            )}
            {it.caption && <figcaption>{it.caption}</figcaption>}
          </figure>
        ))}
        {!all && items.length > limit && (
          <button className="shot shot-more tile-more" onClick={() => setAll(true)}>+{items.length - limit} más</button>
        )}
      </div>
      {svAt !== null && items[svAt]?.sv && <SvModal sv={items[svAt].sv!} title={items[svAt].caption ?? 'Ejemplo'} credit={items[svAt].source} onClose={() => setSvAt(null)} />}
      {box !== null && (
        <Lightbox
          images={items.map((it) => it.image)}
          index={box}
          onClose={() => setBox(null)}
          captionOf={(j) => (items[j]?.caption ? <span>{items[j].caption}</span> : undefined)}
        />
      )}
    </>
  )
}

type SV = NonNullable<Hint['sv']>
/**
 * Street View incrustado en la vista exacta del ejemplo (la forma que Google
 * permite: insertar, no copiar capturas). Solo se carga al pedirlo.
 */
export function StreetViewEmbed({ sv, startOpen = false }: { sv: SV; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  // formato de "Compartir → Insertar mapa" de Google Maps (sin clave)
  const zoom = Math.max(0, Math.min(3, Math.log2(90 / Math.max(10, sv.f)) + 1)).toFixed(2)
  const src = sv.p
    ? `https://www.google.com/maps/embed?pb=!4v1!6m8!1m7!1s${encodeURIComponent(sv.p)}!2m2!1d${sv.lat}!2d${sv.lng}!3f${sv.h}!4f${sv.t}!5f${zoom}`
    : `https://maps.google.com/maps?q=&layer=c&cbll=${sv.lat},${sv.lng}&cbp=11,${sv.h},0,0,${sv.t}&output=svembed`
  const link = `https://www.google.com/maps/@?api=1&map_action=pano${sv.p ? `&pano=${sv.p}` : ''}&viewpoint=${sv.lat},${sv.lng}&heading=${sv.h}&pitch=${sv.t}&fov=${sv.f}`
  if (!open)
    return (
      <button className="sv-open" onClick={() => setOpen(true)}>
        <span className="sv-dot" />Ver el ejemplo en Street View
      </button>
    )
  return (
    <div className="sv">
      <iframe src={src} title="Street View del ejemplo" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
      <div className="sv-bar">
        <span>Street View · Google</span>
        <a href={link} target="_blank" rel="noreferrer">Abrir en Google Maps</a>
        <button className="link" onClick={() => setOpen(false)}>Cerrar</button>
      </div>
    </div>
  )
}

/** Street View en un modal (desde una foto del mosaico). */
function SvModal({ sv, title, credit, onClose }: { sv: SV; title: string; credit?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const drag = useDragToClose(onClose)
  return createPortal(
    <div className="pm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-box sv-box" onClick={(e) => e.stopPropagation()} style={drag.style}>
        <div className="pm-head" {...drag.handle}>
          <div><span className="eyebrow">Street View</span><strong>{title}</strong>{credit && <span className="pm-desc">Ejemplo de {SOURCE_NAMES[credit] ?? credit}</span>}</div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <StreetViewEmbed sv={sv} startOpen />
      </div>
    </div>,
    document.body,
  )
}

/** Una pista deduplicada: texto, imágenes, ejemplos y sus fuentes. */
/** País y nombres de categoría de la guía que se está viendo (para guardar sus pistas). */
export const HintScope = createContext<{ cc?: string; catName?: (id: string) => string }>({})

export function HintItem({ cluster, hints, lang, category, topic }: {
  cluster: Cluster
  hints: Map<number, Hint>
  lang: Lang
  category?: string
  /** enlace al tema completo (desde "Lo esencial") */
  topic?: { label: string; onClick: () => void }
}) {
  const [open, setOpen] = useState(false)
  const canonical = hints.get(cluster.canonical_id)
  if (!canonical) return null
  const members = cluster.members.map((id) => hints.get(id)).filter((h): h is Hint => Boolean(h))
  const images = cluster.images ?? [...new Set(members.flatMap((m) => m.images))]
  const links = [...new Map(members.flatMap((m) => m.links ?? []).map((l) => [l.url, l])).values()]
  const places = [...new Map(members.flatMap((m) => m.places ?? []).map((p) => [p.n.toLowerCase(), p])).values()]
  const sv = members.find((m) => m.sv?.p)?.sv ?? members.find((m) => m.sv)?.sv
  const [mapAt, setMapAt] = useState<number | null>(null)
  const text = hintText(canonical, lang)
  const sources = cluster.sources.map((s) => SOURCE_NAMES[s] ?? s)
  const scope = useContext(HintScope)
  const saveable = scope.cc ? hintItem(cluster, hints, lang, scope.cc, scope.catName) : null
  // si ya la estudias: cuánto la recuerdas hoy
  const study = useStudy()
  const card = study.cards[`t:${cluster.id}`]?.state
  const known = card ? retrievability(card) : 0

  return (
    <article className="hint">
      {text && <HintText text={text} places={places} onPlace={setMapAt} />}
      {images.length > 0 && <Gallery images={images} limit={6} strip />}
      {images.length > 0 && (
        <div className="img-credit">
          Imágenes:{' '}
          {[...new Map(members.filter((m) => m.images.length).map((m) => [m.source_id, m])).values()].map((m, i, arr) => (
            <span key={m.source_id}>
              {m.url ? <a href={m.url} target="_blank" rel="noreferrer">{SOURCE_NAMES[m.source_id] ?? m.source_id}</a> : SOURCE_NAMES[m.source_id] ?? m.source_id}
              {i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
      {sv && <StreetViewEmbed sv={sv} />}
      {places.length > 0 && (
        <div className="hint-places">
          <span className="muted">En el mapa:</span>
          {places.slice(0, 8).map((p, j) => (
            <button key={p.n} className="place-chip" onClick={() => setMapAt(j)}>
              <span className="place-pin" aria-hidden="true" />{lang === 'es' ? p.es ?? p.n : p.n}
            </button>
          ))}
        </div>
      )}
      {mapAt !== null && <PlaceMap places={places} index={mapAt} onClose={() => setMapAt(null)} hints={hints} lang={lang} />}
      {links.length > 0 && (
        <div className="hint-examples">
          <span className="muted">Ejemplos:</span>
          {links.slice(0, 8).map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.text}</a>
          ))}
        </div>
      )}
      <div className="hint-meta">
        {saveable && <SaveButton item={saveable} />}
        {known > 0 && <span className={`hint-known ${known >= 0.85 ? 'good' : known >= 0.6 ? 'mid' : 'low'}`} title="Probabilidad de que hoy la recuerdes (FSRS)">la recuerdas al {Math.round(known * 100)} %</span>}
        {topic && <button className="link topic-link" onClick={topic.onClick}>{topic.label} →</button>}
        {cluster.usefulness === 3 && !topic && <Usefulness value={3} />}
        {cluster.region && <span>{cluster.region}</span>}
        {category && <span>{category}</span>}
        <span>{cluster.source_count > 1 ? `${cluster.source_count} fuentes: ` : ''}{sources.join(', ')}</span>
        {canonical.location_url && <a href={canonical.location_url} target="_blank" rel="noreferrer">Ver ubicación</a>}
        {members.length > 1 && (
          <button className="link" onClick={() => setOpen(!open)}>{open ? 'Ocultar fuentes' : 'Comparar fuentes'}</button>
        )}
      </div>
      {open && (
        <div className="hint-sources">
          {members.map((m) => (
            <div key={m.id}>
              <strong>{SOURCE_NAMES[m.source_id] ?? m.source_id}</strong>
              {m.url && <> · <a href={m.url} target="_blank" rel="noreferrer">original</a></>}
              {m.text && <HintText text={m.text} />}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

/** Un objeto de meta (bolardo, matrícula…) con sus rasgos y relaciones. */
export function ObjectCard({ obj, map, traitCount, showCountry }: {
  obj: MetaObject
  map: Map<string, CountryRow>
  traitCount: (type: string, key: string, value: string) => number | undefined
  showCountry?: boolean
}) {
  // en tipos sencillos (líneas, matrículas) "mismo diseño" empareja a medio mundo: solo si es poco común
  const design = [...new Map(obj.sameDesign.map((d) => [d.country, d])).values()].filter((d) => d.shared >= 3 || obj.sameDesign.length <= 6)
  const qualifier = [obj.variant !== 'main' ? VARIANT_LABEL[obj.variant] : null, obj.region].filter(Boolean).join(' · ')
  return (
    <article className="object">
      <header className="object-head">
        <strong>{OBJECT_LABEL[obj.type]?.label ?? obj.type}</strong>
        {qualifier && <span className="muted">{qualifier}</span>}
        {showCountry && <span className="muted">{countryFlag(map, obj.country)} {countryLabel(map, obj.country)}</span>}
      </header>
      <dl className="traits">
        {Object.entries(obj.attrs).map(([k, v]) => {
          const r = rarityText(traitCount(obj.type, k, v))
          return (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{attrLabel(k)}</dt>
              <dd>
                <Swatch value={v} /> {valueLabel(v)}
                {r && <span className={r.cls}>· {r.text}</span>}
              </dd>
            </div>
          )
        })}
      </dl>
      {obj.features.length > 0 && <p className="object-notes">{obj.features.join(' · ')}</p>}
      {(obj.alsoIn.length > 0 || obj.confusedWith.length > 0 || design.length > 0) && (
        <div className="relations">
          {obj.alsoIn.length > 0 && (
            <div>
              <span className="label">También en</span>
              <div className="chips">{obj.alsoIn.map((c) => <CountryChip key={c} code={c} map={map} />)}</div>
            </div>
          )}
          {obj.confusedWith.length > 0 && (
            <div>
              <span className="label">Se confunde con</span>
              {obj.confusedWith.map((c, i) => (
                <div key={i}>
                  <CountryChip code={c.country} map={map} />
                  {c.difference && <p className="diff-note">{c.difference}</p>}
                </div>
              ))}
            </div>
          )}
          {design.length > 0 && (
            <div>
              <span className="label">Mismo diseño</span>
              <div className="chips">{design.slice(0, 8).map((d) => <CountryChip key={d.country} code={d.country} map={map} />)}</div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * Perfil de un objeto en su tema de la guía: rasgos en una línea legible,
 * marcando solo los poco comunes, y con qué países se comparte o confunde.
 */
export function ObjectProfile({ obj, map, traitCount }: {
  obj: MetaObject
  map: Map<string, CountryRow>
  traitCount: (type: string, key: string, value: string) => number | undefined
}) {
  const design = [...new Map(obj.sameDesign.map((d) => [d.country, d])).values()]
    .filter((d) => d.country !== obj.country && !obj.alsoIn.includes(d.country))
    .filter((d) => d.shared >= 3 || obj.sameDesign.length <= 6)
  const qualifier = [obj.variant !== 'main' ? VARIANT_LABEL[obj.variant] : null, obj.region].filter(Boolean).join(' · ')
  return (
    <div className="profile">
      <div className="profile-head">
        <strong>{OBJECT_LABEL[obj.type]?.label ?? obj.type}</strong>
        {qualifier && <span className="muted">{qualifier}</span>}
      </div>
      <ul className="profile-traits">
        {Object.entries(obj.attrs).map(([k, v]) => {
          const n = traitCount(obj.type, k, v)
          return (
            <li key={k}>
              <span className="k">{attrLabel(k)}</span>
              <Swatch value={v} />
              {valueLabel(v)}
              {n !== undefined && n <= 3 && (
                <span className="rare" title={`Solo ${n === 1 ? 'este país' : `${n} países`} lo tienen`}>
                  {n === 1 ? 'solo aquí' : `${n} países`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {obj.features.length > 0 && <p className="profile-notes">{obj.features.join(' · ')}</p>}
      {obj.alsoIn.length > 0 && (
        <div className="profile-rel">
          <span>También en</span>
          {obj.alsoIn.map((c) => <CountryChip key={c} code={c} map={map} />)}
        </div>
      )}
      {obj.confusedWith.map((c, i) => (
        <div key={i} className="profile-rel">
          <span>Se confunde con</span>
          <CountryChip code={c.country} map={map} />
          {c.difference && <em>{c.difference}</em>}
        </div>
      ))}
      {design.length > 0 && (
        <div className="profile-rel">
          <span>Diseño parecido</span>
          {design.slice(0, 8).map((d) => <CountryChip key={d.country} code={d.country} map={map} />)}
        </div>
      )}
    </div>
  )
}

/** Lugar que se abre en la ficha: `id` es el de la entidad de la base geográfica (si se conoce). */
export type Place = { id?: string; n: string; es?: string; lat: number; lng: number; k?: string; cc?: string }
// zoom del mapa según el tipo de lugar: una ciudad de cerca, un estado entero
const PLACE_ZOOM: Record<string, number> = {
  city: 11, town: 13, urban: 10, other: 9, natural: 9, island: 9, peninsula: 8, coast: 9, delta: 8, wetland: 9,
  region: 6, admin1: 6, country: 5, volcano: 11, mountain: 11, range: 7, plain: 6, plateau: 6, desert: 6, basin: 6, valley: 8,
  river: 8, lake: 10, waterfall: 14, forest: 9, national_park: 10,
  monument: 16, temple: 16, church: 16, mosque: 16, castle: 16, palace: 16, bridge: 15, archaeological: 15, landmark: 15,
}

/**
 * Lo que una pista dice de un lugar: el párrafo que lo nombra (si el nombre es solo
 * un título, el párrafo siguiente), sin listas de nombres sueltos, en una o dos frases.
 */
function placeSnippet(text: string, name: string, max = 230): string | null {
  const core = placeCore(name).toLowerCase()
  const forms = [...new Set([name.toLowerCase(), core])].filter((f) => f.length >= 3)
  const lines = text.split(/\n+/).map((l) => l.replace(/^[\s•▪●◦·*–-]+/, '').trim()).filter((l) => l && !/^-{2,}/.test(l))
  const has = (l: string) => forms.some((f) => l.toLowerCase().includes(f))
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!has(l)) continue
    // título o elemento de lista (solo el nombre): se toma lo que viene después
    if (l.length < name.length + 25) {
      const next = lines.slice(i + 1).find((x) => x.length > 40)
      if (next && lines.slice(i + 1, i + 3).includes(next)) return clipSentences(next, max)
      continue
    }
    return clipSentences(l, max)
  }
  return null
}
function clipSentences(t: string, max: number) {
  const parts = t.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [t]
  let out = ''
  for (const p of parts) {
    if ((out + p).length > max && out) break
    out += p
  }
  out = out.trim() || t
  return out.length > max ? out.slice(0, max - 1).trimEnd() + '…' : out
}

/**
 * Ficha de un lugar mencionado en una pista: qué es (Wikipedia, con foto), qué
 * dicen nuestras pistas de ese lugar, su mapa y enlaces a Google Maps / Street View.
 */
export function PlaceMap({ places, index = 0, onClose, hints, lang = 'es' }: {
  places: Place[]
  index?: number
  onClose: () => void
  hints?: Map<number, Hint>
  lang?: Lang
}) {
  const [i, setI] = useState(index)
  const [wide, setWide] = useState(false)
  const drag = useDragToClose(onClose)
  const [fetched, setFetched] = useState<PlaceWiki | null | undefined>(undefined)
  const [photo, setPhoto] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const p = places[i]
  const label = (x: Place) => (lang === 'es' ? x.es ?? x.n : x.n)
  // ficha de la base geográfica (Wikipedia elegida por el pipeline, datos, región…); si no la hay, se busca al momento
  const ent = useGeo(p.id ? `entity:${p.id}` : null, () => geo.entity(p.id!))
  const e = ent.data?.id === p.id ? ent.data : undefined
  const ownHints = useCountryFile(hints ? undefined : p.cc)
  const hintPool = hints ?? (ownHints ? new Map(ownHints.hints.map((h) => [h.id, h])) : undefined)
  const countries = useCountryMap()
  const country = p.cc ?? e?.cc ? countries.get((p.cc ?? e?.cc)!) : undefined
  const pending = Boolean(p.id) && !e && !ent.error
  const hasInfo = Boolean(e && (e.summary || e.image))
  useEffect(() => {
    if (pending || hasInfo) return
    let alive = true
    setFetched(undefined)
    fetchPlaceWiki(p.es ?? p.n, p.lat, p.lng).then((w) => alive && setFetched(w))
    return () => {
      alive = false
    }
  }, [p.n, p.lat, p.lng, pending, hasInfo]) // eslint-disable-line react-hooks/exhaustive-deps
  const wiki: PlaceWiki | null | undefined = e && hasInfo
    ? { title: e.name, description: e.descr ?? null, extract: e.summary ?? '', image: e.image ?? null, pageUrl: e.wiki ?? '', lang: e.wiki_lang === 'en' ? 'en' : 'es' }
    : pending
      ? undefined
      : fetched
  const metrics = e ? entityMetrics(e) : []
  const region = e?.parents.find((x) => x.predicate === 'in_admin1')
  const within = e?.parents.filter((x) => x.predicate !== 'in_admin1') ?? []

  // pistas del país que mencionan este mismo lugar
  const key = p.n.toLowerCase()
  const seenText = new Set<string>()
  const related = [...(hintPool?.values() ?? [])]
    .filter((h) => h.places?.some((x) => (p.id && x.id === p.id) || x.n.toLowerCase() === key))
    .map((h) => ({ h, text: placeSnippet(hintText(h, lang), p.es ?? p.n) ?? placeSnippet(hintText(h, lang), p.n) ?? placeSnippet(h.text ?? '', p.n) }))
    .filter((x): x is { h: Hint; text: string } => Boolean(x.text))
    .filter(({ text }) => {
      // la misma pista copiada por varias fuentes: una sola vez
      const sig = text.toLowerCase().replace(/[^a-záéíóúñü]+/g, '').slice(0, 60)
      if (seenText.has(sig)) return false
      seenText.add(sig)
      return true
    })
    .slice(0, 6)
  const k = e?.kind ?? p.k ?? 'other'
  const zoom = wide ? 5 : PLACE_ZOOM[k] ?? 9
  // las coordenadas de la entidad mandan (las del mapa o la mención pueden ser aproximadas)
  const ll = e && Number.isFinite(e.lat) ? `${e.lat},${e.lng}` : `${p.lat},${p.lng}`
  const kind = kindLabel(k)

  return createPortal(
    <div className="pm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-box" onClick={(e) => e.stopPropagation()} style={drag.style}>
        <div className="pm-head" {...drag.handle}>
          <div>
            <span className="eyebrow">{kind}</span>
            <strong>{label(p)}</strong>
            {(wiki?.description ?? e?.descr) && <span className="pm-desc">{wiki?.description ?? e?.descr}</span>}
            {(e?.tags?.includes('unesco') || region || within.length > 0) && (
              <span className="pm-facts">
                {e?.tags?.includes('unesco') && <em>Patrimonio de la Humanidad</em>}
                {region && <span>{region.name}</span>}
                {within.map((x) => <span key={x.id}>{kindLabel(x.kind)}: {x.name}</span>)}
              </span>
            )}
            {country &&
              (country.groups > 0 ? (
                <Link to={`/pais/${country.code}`} className="pm-country" onClick={onClose}>
                  {country.flag} {country.name_es ?? country.name} · ver la guía
                </Link>
              ) : (
                <span className="pm-country pm-country-plain">{country.flag} {country.name_es ?? country.name}</span>
              ))}
          </div>
          <div className="pm-actions">
            {e && Number.isFinite(e.lat) && (
              <SaveButton item={placeItem({ id: e.id, kind: e.kind, name: e.name, cc: e.cc ?? undefined, lat: e.lat, lng: e.lng, thumb: e.thumb ?? undefined, descr: e.descr ?? undefined, bbox: e.bbox ?? undefined })} />
            )}
            <button className="btn btn-quiet" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>
        {places.length > 1 && (
          <div className="pm-places">
            {places.map((x, j) => (
              <button key={x.n + j} className={j === i ? 'on' : ''} onClick={() => { setI(j); setWide(false) }}>{label(x)}</button>
            ))}
          </div>
        )}
        <div className="pm-body">
          <div className="pm-top">
            {wiki?.image && (
              <button className="pm-photo" onClick={() => setPhoto(wiki.image)} aria-label="Ampliar foto">
                <Img src={wiki.image} size="img" sizes="(max-width: 700px) 92vw, 420px" loading="eager" alt={wiki.title} />
              </button>
            )}
            <div className="pm-mapwrap">
              <iframe key={`${ll}-${zoom}`} className="pm-map" title={`Mapa de ${p.n}`} loading="lazy" src={`https://maps.google.com/maps?q=${ll}&z=${zoom}&output=embed`} />
              <div className="seg seg-sm pm-zoom">
                <button className={!wide ? 'on' : ''} onClick={() => setWide(false)}>De cerca</button>
                <button className={wide ? 'on' : ''} onClick={() => setWide(true)}>En el país</button>
              </div>
            </div>
          </div>

          {e && Object.keys(e.children).length > 0 && (
            <p className="pm-contains">
              <span>Contiene</span>
              {Object.entries(e.children)
                .filter(([kind]) => kind !== 'admin1' || e.kind === 'country')
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([kind, n]) => <b key={kind}>{kindCount(kind, n)}</b>)}
            </p>
          )}
          {metrics.length > 0 && (
            <dl className="pm-metrics">
              {metrics.map(([label, v]) => (
                <div key={label}><dt>{label}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
          {wiki === undefined ? (
            <p className="muted small">Buscando información del lugar…</p>
          ) : wiki ? (
            <div className="pm-wiki">
              <p>{clipSentences(wiki.extract, 620)}</p>
              {wiki.pageUrl ? (
                <a href={wiki.pageUrl} target="_blank" rel="noreferrer" className="muted small">Wikipedia{wiki.lang === 'en' ? ' (en inglés)' : ''} · CC BY-SA</a>
              ) : e?.kind === 'volcano' ? (
                <span className="muted small">Resumen geológico: Smithsonian Global Volcanism Program</span>
              ) : null}
            </div>
          ) : null}

          {related.length > 0 && (
            <div className="pm-related">
              <span className="eyebrow">Lo que dicen las pistas de {label(p)}</span>
              {related.map(({ h, text }) => (
                <div key={h.id} className="pm-hint">
                  {h.images[0] && (
                    <button className="pm-hint-img" onClick={() => setPhoto(h.images[0])} aria-label="Ampliar">
                      <Img src={h.images[0]} sizes="96px" />
                    </button>
                  )}
                  <div>
                    <p>{text}</p>
                    {h.url && <a className="pm-hint-src" href={h.url} target="_blank" rel="noreferrer">{SOURCE_NAMES[h.source_id] ?? h.source_id} →</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pm-actions">
          {e && Object.keys(e.children).length > 0 && e.kind !== 'country' && (
            <Link className="btn" to={`/geografia?dentro=${encodeURIComponent(e.id)}${e.cc ? `&pais=${e.cc}` : ''}`} onClick={onClose}>Ver sus lugares</Link>
          )}
          <a className="btn btn-primary" href={`https://www.google.com/maps/search/?api=1&query=${ll}`} target="_blank" rel="noreferrer">Abrir en Google Maps</a>
          <a className="btn" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}`} target="_blank" rel="noreferrer">Street View aquí</a>
          {wiki?.pageUrl && (
            <a className="btn" href={wiki.pageUrl} target="_blank" rel="noreferrer">Leer en Wikipedia{wiki.lang === 'en' ? ' (inglés)' : ''}</a>
          )}
        </div>
      </div>
      {photo && <Lightbox images={[photo]} index={0} onClose={() => setPhoto(null)} />}
    </div>,
    document.body,
  )
}
