import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { Cluster, CountryRow, Hint, MetaObject } from '../lib/data'
import { countryFlag, countryLabel } from '../lib/data'
import { hintText, type Lang } from '../lib/i18n'
import { COLOR_HEX, OBJECT_LABEL, SOURCE_NAMES, USEFULNESS, VARIANT_LABEL, attrLabel, valueLabel } from '../lib/labels'
import { imageSrc } from '../lib/images'

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

export function Loading({ what = 'datos' }: { what?: string }) {
  return <div className="empty">Cargando {what}…</div>
}

/**
 * Visor a pantalla completa. Se monta directamente en <body>: dentro de la
 * página, cualquier ancestro con transform (animaciones) hace que position:
 * fixed se calcule respecto a ese ancestro y no cubra la ventana.
 */
export function Lightbox({ images, index, onClose, caption }: {
  images: string[]
  index: number
  onClose: () => void
  caption?: React.ReactNode
}) {
  const [i, setI] = useState(index)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(images.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [images.length, onClose])

  return createPortal(
    <div className="lb" onClick={onClose} role="dialog" aria-modal="true">
      <img className="lb-img" src={imageSrc(images[i])} alt="" onClick={(e) => e.stopPropagation()} />
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && <span className="num">{i + 1} / {images.length}</span>}
        {caption}
        <a href={images[i]} target="_blank" rel="noreferrer">Abrir original</a>
      </div>
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Cerrar">✕</button>
      {images.length > 1 && i > 0 && (
        <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); setI(i - 1) }} aria-label="Anterior">‹</button>
      )}
      {images.length > 1 && i < images.length - 1 && (
        <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); setI(i + 1) }} aria-label="Siguiente">›</button>
      )}
    </div>,
    document.body,
  )
}

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
            <img src={imageSrc(src, strip && images.length === 1 ? 'img' : 'thumb')} loading="lazy" alt="" onError={hideBroken} />
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

function Blocks({ list }: { list: Block[] }) {
  return (
    <>
      {list.map((b, i) =>
        b.kind === 'p' ? <p key={i}>{b.text}</p> : <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>,
      )}
    </>
  )
}

/**
 * Texto de una pista con su estructura: viñetas como lista, sin líneas en
 * blanco ni separadores, y la parte "--- NOTE:" (Learnable Meta) como nota.
 */
export function HintText({ text }: { text: string }) {
  // "--- NOTE:" (Learnable Meta) o "NOTA:" al inicio de línea (Geometas)
  const [main, ...notes] = text.split(/\s*-{2,}\s*(?:NOTE|NOTA|Note|Nota)\s*:?\s*|\n\s*(?:NOTE|NOTA|Note|Nota)\s*:\s*/)
  const note = blocks(notes.join('\n'))
  return (
    <div className="hint-text">
      <Blocks list={blocks(main)} />
      {note.length > 0 && (
        <div className="hint-note">
          <span>Nota</span>
          <div><Blocks list={note} /></div>
        </div>
      )}
    </div>
  )
}

/** Fotos con pie (marcas, variantes de matrícula…): imagen completa y su nombre debajo. */
export function PhotoTiles({ items, limit = 12 }: { items: { image: string; caption?: string | null }[]; limit?: number }) {
  const [box, setBox] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  if (!items.length) return null
  const shown = all ? items : items.slice(0, limit)
  return (
    <>
      <div className="tiles">
        {shown.map((it, i) => (
          <figure key={it.image} className="tile">
            <button className="shot" onClick={() => setBox(i)} aria-label="Ampliar imagen">
              <img src={imageSrc(it.image, 'thumb')} loading="lazy" alt={it.caption ?? ''} onError={(e) => hideBroken(e, '.tile')} />
            </button>
            {it.caption && <figcaption>{it.caption}</figcaption>}
          </figure>
        ))}
        {!all && items.length > limit && (
          <button className="shot shot-more tile-more" onClick={() => setAll(true)}>+{items.length - limit} más</button>
        )}
      </div>
      {box !== null && (
        <Lightbox
          images={items.map((it) => it.image)}
          index={box}
          onClose={() => setBox(null)}
          caption={items[box]?.caption ? <span>{items[box].caption}</span> : undefined}
        />
      )}
    </>
  )
}

/** Una pista deduplicada: texto, imágenes, ejemplos y sus fuentes. */
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
  const text = hintText(canonical, lang)
  const sources = cluster.sources.map((s) => SOURCE_NAMES[s] ?? s)

  return (
    <article className="hint">
      {text && <HintText text={text} />}
      {images.length > 0 && <Gallery images={images} limit={6} strip />}
      {links.length > 0 && (
        <div className="hint-examples">
          <span className="muted">Ejemplos:</span>
          {links.slice(0, 8).map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.text}</a>
          ))}
        </div>
      )}
      <div className="hint-meta">
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
