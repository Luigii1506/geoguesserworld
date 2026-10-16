import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCountryMap, countryFlag, countryLabel } from '../lib/data'
import { REGION_ES, SOURCE_NAMES } from '../lib/labels'
import { DataError, Lightbox, Loading } from '../components/ui'
import { useGeo } from '../lib/geo'
import { guides, type VisualItem, type VisualQuery } from '../lib/guides'
import { Img } from '../components/Img'
import { SaveButton, StudyAllButton } from '../components/study/SaveButton'
import { photoItem } from '../lib/study/items'
import { CountryPicker } from '../components/geo/CountryPicker'

// Explorador de fotos: una categoría, todos los países, con las imágenes de
// todas las fuentes. Pide a la API páginas de 60 fotos (y las facetas de la
// categoría) en lugar de descargar el índice entero.
// Filtros en chips (como el Catálogo) y en la URL: ?tema=&tipo=&pais=&continente=&fuente=

const SOURCE_BY_LETTER: Record<string, string> = { p: 'plonkit', g: 'geometas', h: 'geohints', t: 'geotips', l: 'learnablemeta', o: 'openguessr' }
const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
const PAGE = 60
// fotos que se guardan de una vez con «Estudiar estas fotos»
const STUDY_MAX = 120

export default function Visual() {
  const meta = useGeo('gg-visual-meta', guides.visualMeta)
  const map = useCountryMap()
  const [params, setParams] = useSearchParams()
  const cat = params.get('tema') ?? 'bollards'
  const sub = params.get('tipo') ?? ''
  const region = params.get('continente') ?? ''
  const pais = params.get('pais') ?? ''
  const fuente = params.get('fuente') ?? ''
  const set = (patch: Record<string, string | null>) => {
    setBox(null)
    setParams((p) => {
      const n = new URLSearchParams(p)
      for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k))
      if (n.get('tema') === 'bollards') n.delete('tema')
      return n
    }, { replace: true })
  }
  // en el móvil las filas de chips se deslizan: la opción elegida, a la vista
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>('.vis-groups .on, .vis-topics .on')) {
      const row = el.parentElement!
      if (row.scrollWidth > row.clientWidth) row.scrollLeft += el.getBoundingClientRect().left - row.getBoundingClientRect().left - 16
    }
  }, [cat, meta.data])
  const [items, setItems] = useState<VisualItem[]>([])
  const [total, setTotal] = useState(0)
  const [facets, setFacets] = useState<{ subs: [string, number][]; countries: Record<string, number> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [box, setBox] = useState<number | null>(null)

  const query: VisualQuery = { cat, sub: sub || undefined, cc: pais || undefined, continent: region || undefined, src: fuente || undefined, limit: PAGE }
  const key = JSON.stringify(query)
  // primera página (con facetas) cada vez que cambian los filtros
  useEffect(() => {
    let alive = true
    setLoading(true)
    guides.visual({ ...query, offset: 0 }).then(
      (r) => {
        if (!alive) return
        setItems(r.items)
        setTotal(r.total)
        if (r.facets) setFacets(r.facets)
        setLoading(false)
      },
      () => alive && setLoading(false),
    )
    return () => {
      alive = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const more = () => {
    setLoading(true)
    guides.visual({ ...query, offset: items.length }).then((r) => {
      setItems((x) => [...x, ...r.items])
      setLoading(false)
    })
  }

  if (meta.error) return <DataError error={meta.error} what="las fotos" />
  if (!meta.data) return <Loading what="fotos" />

  const catName = (id: string) => meta.data?.categories.find((c) => c.id === id)?.name ?? id
  const label = (code: string | null, raw?: string) => (code ? countryLabel(map, code) : raw ?? '—')
  const countries = Object.keys(facets?.countries ?? {}).sort((a, b) => label(a).localeCompare(label(b), 'es'))
  const photos = Object.values(meta.data.counts).reduce((a, b) => a + b, 0)
  const cats = meta.data.categories.filter((c) => (meta.data!.counts[c.id] ?? 0) > 0)
  const groups = [...new Set(cats.map((c) => c.grp))]
  const group = cats.find((c) => c.id === cat)?.grp ?? groups[0]
  const countryOptions = countries.map((c) => ({ code: c, n: facets!.countries[c], flag: countryFlag(map, c), name: label(c), alt: map.get(c)?.name ?? '' }))

  return (
    <div>
      <header className="page-head">
        <h1>Fotos</h1>
        <p className="lead">
          {photos.toLocaleString('es')} imágenes de seis fuentes. Elige un tema y compara cómo es en cada país.
          {' '}Para ver una ficha por país (bolardos, postes, matrículas…) con sus rasgos, abre el <Link to="/catalogo">Catálogo</Link>.
        </p>
      </header>

      {/* tema: el grupo y, dentro, cada tema con su número de fotos */}
      <nav className="cat-types vis-groups" aria-label="Grupo de temas">
        {groups.map((g) => (
          <button key={g} className={`cat-type ${g === group ? 'on' : ''}`} onClick={() => g !== group && set({ tema: cats.find((c) => c.grp === g)!.id, tipo: null, pais: null })}>
            {g}
          </button>
        ))}
      </nav>
      <div className="chips vis-topics" role="group" aria-label="Tema">
        {cats.filter((c) => c.grp === group).map((c) => (
          <button key={c.id} className={`chip ${c.id === cat ? 'on' : ''}`} onClick={() => set({ tema: c.id, tipo: null, pais: null })}>
            {c.name} <span className="muted">{meta.data!.counts[c.id].toLocaleString('es')}</span>
          </button>
        ))}
      </div>

      <div className="toolbar vis-toolbar">
        <div className="seg">
          <button className={!region ? 'on' : ''} onClick={() => set({ continente: null })}>Todo</button>
          {REGIONS.map((r) => <button key={r} className={region === r ? 'on' : ''} onClick={() => set({ continente: r, pais: null })}>{REGION_ES[r]}</button>)}
        </div>
        {countryOptions.length > 0 && <CountryPicker value={pais} onChange={(v) => set({ pais: v || null })} options={countryOptions} />}
      </div>
      <div className="chips vis-sources" role="group" aria-label="Fuente">
        <button className={`chip ${!fuente ? 'on' : ''}`} onClick={() => set({ fuente: null })}>Todas las fuentes</button>
        {Object.entries(SOURCE_BY_LETTER).map(([k, v]) => (
          <button key={k} className={`chip ${fuente === k ? 'on' : ''}`} onClick={() => set({ fuente: fuente === k ? null : k })}>{SOURCE_NAMES[v]}</button>
        ))}
      </div>

      {(facets?.subs.length ?? 0) > 0 && (
        <div className="chips vis-subs" role="group" aria-label="Tipo">
          <span className="eyebrow">Tipo</span>
          <button className={`chip ${!sub ? 'on' : ''}`} onClick={() => set({ tipo: null })}>Todos</button>
          {facets!.subs.map(([s, n]) => (
            <button key={s} className={`chip ${sub === s ? 'on' : ''}`} onClick={() => set({ tipo: s })}>
              {s.replace(/_/g, ' ')} <span className="muted">{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <p className="muted small" style={{ margin: 0 }}>{total.toLocaleString('es')} fotos</p>
        {total > 0 && (
          <StudyAllButton
            key={key}
            className="btn btn-sm"
            label={`Estudiar ${Math.min(total, STUDY_MAX)} de estas fotos`}
            deckName={[catName(cat), sub && sub.replace(/_/g, ' '), pais ? label(pais) : region ? REGION_ES[region] : ''].filter(Boolean).join(' · ')}
            items={async () => {
              const want = Math.min(total, STUDY_MAX)
              // con un país, sus fotos (las de pantalla y las páginas siguientes)
              if (pais) {
                const all = [...items]
                while (all.length < want) {
                  const r = await guides.visual({ ...query, offset: all.length, limit: 60 })
                  if (!r.items.length) break
                  all.push(...r.items)
                }
                return all.slice(0, want).filter((it) => it.c).map((it) => photoItem(it, catName))
              }
              // sin país: unas pocas de cada uno (la lista va por orden alfabético de país, así que
              // se piden por país: los que más fotos tienen de este tema)
              const per = 3
              const ccs = Object.entries(facets?.countries ?? {}).sort((x, y) => y[1] - x[1]).slice(0, Math.ceil(want / per)).map(([c]) => c)
              const out: VisualItem[] = []
              for (let i = 0; i < ccs.length; i += 8) {
                const pages = await Promise.all(ccs.slice(i, i + 8).map((c) => guides.visual({ ...query, cc: c, offset: 0, limit: per }).catch(() => null)))
                for (const r of pages) if (r) out.push(...r.items)
              }
              return out.slice(0, want).filter((it) => it.c).map((it) => photoItem(it, catName))
            }}
          />
        )}
      </div>

      <div className={`photo-grid ${loading && !items.length ? 'is-stale' : ''}`}>
        {items.map((it, i) => (
          <figure key={it.id} className="photo" style={{ margin: 0, position: 'relative' }}>
            <button className="shot" onClick={() => setBox(i)} aria-label="Ampliar">
              <Img src={it.i} />
            </button>
            {it.c && <span className="photo-save"><SaveButton compact item={photoItem(it, catName)} /></span>}
            <figcaption className="photo-caption">
              <span>{it.c ? countryFlag(map, it.c) : ''} {label(it.c, it.n)}</span>
              <span className="muted">{SOURCE_NAMES[SOURCE_BY_LETTER[it.s]] ?? it.s}</span>
            </figcaption>
            {it.t && <p className="photo-text">{it.t}</p>}
          </figure>
        ))}
      </div>

      {total > items.length && (
        <div style={{ textAlign: 'center', marginTop: '1.6rem' }}>
          <button className="btn" disabled={loading} onClick={more}>{loading ? 'Cargando…' : `Mostrar más (${(total - items.length).toLocaleString('es')})`}</button>
        </div>
      )}

      {box !== null && (
        <Lightbox
          images={items.map((it) => it.i)}
          index={box}
          onClose={() => setBox(null)}
          captionOf={(j) => <span>{items[j]?.c ? countryFlag(map, items[j].c!) : ''} {label(items[j]?.c ?? null, items[j]?.n)}</span>}
        />
      )}
    </div>
  )
}
