import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Cluster, CountryRow, Hint, MetaObject } from '../lib/data'
import type { Lang } from '../lib/i18n'
import { OBJECT_LABEL, SUBCATEGORY_LABEL, VARIANT_LABEL, valueLabel } from '../lib/labels'
import type { Guide, Part, Topic } from '../lib/guide'
import { HintItem, ObjectProfile, PhotoTiles } from './ui'

const FACT_VALUE: Record<string, string> = { Outdoor: 'sí, en exteriores', Indoor: 'solo en interiores' }

export function HintList({ list, hints, lang, limit = 5, topicOf, step }: {
  list: Cluster[]
  hints: Map<number, Hint>
  lang: Lang
  limit?: number
  topicOf?: (c: Cluster) => { label: string; onClick: () => void } | undefined
  /** cuántas más muestra cada "ver más" (por defecto, todas) */
  step?: number
}) {
  const [shown, setShown] = useState(limit)
  return (
    <>
      <div className="hints">
        {list.slice(0, shown).map((c) => (
          <HintItem key={c.id} cluster={c} hints={hints} lang={lang} topic={topicOf?.(c)} />
        ))}
      </div>
      {list.length > shown && (
        <button className="btn more" onClick={() => setShown(step ? shown + step : list.length)}>
          Ver {step ? Math.min(step, list.length - shown) : list.length - shown} más
          {step && list.length - shown > step ? ` (de ${list.length - shown})` : ''}
        </button>
      )}
    </>
  )
}

// Con pocos objetos se muestran todos como perfil; con muchos (matrículas por
// estado) solo los generales arriba y las variantes en una lista plegada.
const MAX_PROFILES = 3
const isMain = (o: MetaObject) => o.variant === 'main' && !o.region
export const mainObjects = (t: Topic) => (t.objects.length <= MAX_PROFILES ? t.objects : t.objects.filter(isMain))
export const variantObjects = (t: Topic) => (t.objects.length <= MAX_PROFILES ? [] : t.objects.filter((o) => !isMain(o)))

export function Variants({ list, open: initial = false }: { list: MetaObject[]; open?: boolean }) {
  const [open, setOpen] = useState(initial)
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
export function PartView({ part, hints, lang, limit = 5 }: { part: Part; hints: Map<number, Hint>; lang: Lang; limit?: number }) {
  const [minor, setMinor] = useState(false)
  return (
    <div className="sub">
      {part.sub && <h3 className="sub-title">{SUBCATEGORY_LABEL[part.sub] ?? part.sub}</h3>}
      {part.hints.length > 0 && <HintList list={part.hints} hints={hints} lang={lang} limit={limit} step={20} />}
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

/** Perfil, datos y pistas de un tema. */
export function TopicBody({ topic, g, lang, limit = 8, showVariants = false }: {
  topic: Topic
  g: Guide
  lang: Lang
  limit?: number
  showVariants?: boolean
}) {
  const main = mainObjects(topic)
  const variants = variantObjects(topic)
  return (
    <>
      {main.length > 0 && (
        <div className="profiles">
          {main.map((o) => <ObjectProfile key={o.id} obj={o} map={g.map} traitCount={g.traitCount} />)}
        </div>
      )}
      {topic.facts.length > 0 && (
        <dl className="topic-facts">
          {topic.facts.map(([title, vals]) => (
            <div key={title}><dt>{title}</dt><dd>{vals.map((v) => FACT_VALUE[v] ?? v).join(' · ')}</dd></div>
          ))}
        </dl>
      )}
      {topic.parts.map((p) => <PartView key={p.sub ?? ''} part={p} hints={g.hints} lang={lang} limit={limit} />)}
      {variants.length > 0 && <Variants list={variants} open={showVariants} />}
    </>
  )
}

/** Migas y nombre del país en las subpáginas (tema, explorador). */
export function CountryCrumbs({ country, here }: { country: CountryRow; here: string }) {
  return (
    <nav className="crumbs">
      <Link to="/paises">Países</Link> / <Link to={`/pais/${country.code}`}>{country.flag} {country.name_es ?? country.name}</Link> / {here}
    </nav>
  )
}
