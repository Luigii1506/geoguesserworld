import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { countryFlag, countryLabel, useCountries, useCountryMap, useJson, useMeta, type CountryRow } from '../lib/data'
import { geo, useGeo } from '../lib/geo'
import { guides } from '../lib/guides'
import { Img } from '../components/Img'
import { dueCount, scopeCounts } from '../lib/study/cards'
import { masteryByCountry, reviewsToday, streak } from '../lib/study/stats'
import { savedItems, useStudy, type StudyState } from '../lib/study/store'

// Inicio: un punto de partida, no una presentación. Si ya estudias, lo de hoy; después, ir
// directo a un país, las secciones con su imagen, por qué países empezar, los gemelos más
// famosos y el método en tres pasos. Todo sale de datos en caché (casi no lee la base).

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('es')
type DuelIndex = { a: string; b: string; score: number; headline: string | null; diffs: number }[]

export default function Home() {
  const meta = useMeta()
  const study = useStudy()
  const countries = useCountries()
  const t = meta?.totals
  const started = Object.keys(study.cards).length > 0
  const due = dueCount(study)

  return (
    <div className="home">
      {study.ready && started && <Today s={study} due={due} />}

      <section className="home-hero">
        <span className="eyebrow">GeoGuessr, con método</span>
        <h1>Reconoce el país en segundos.</h1>
        <p className="lead">Las pistas de las seis grandes guías, sin duplicados y ordenadas por lo que de verdad te ubica.</p>
        <CountryJump countries={countries ?? []} />
        <div className="hero-actions">
          <Link to="/entrenar" className="btn btn-primary btn-lg">{started ? (due > 0 ? `Repasar ${due}` : 'Seguir entrenando') : 'Empieza a entrenar'}</Link>
          <Link to="/paises" className="btn btn-lg">Ver países</Link>
        </div>
      </section>

      <Sections />
      <StartWith countries={countries ?? []} />
      <FamousTwins />

      <section className="home-block">
        <h2>El método</h2>
        <ol className="home-steps">
          <li><strong>Estudia lo esencial</strong><span>Cada país empieza por las pistas que por sí solas te dicen dónde estás.</span></li>
          <li><strong>Distingue a los gemelos</strong><span>Hungría o Rumanía, Uruguay o Argentina: los duelos enseñan la diferencia en fotos.</span></li>
          <li><strong>Repasa a tiempo</strong><span>Guarda lo que quieras aprender; lo que fallas vuelve pronto y lo que dominas, más tarde.</span></li>
        </ol>
      </section>

      <p className="home-stats">
        <span><strong>{fmt(t?.groups)}</strong> pistas</span>
        <span><strong>{fmt(t?.essential)}</strong> determinantes</span>
        <span><strong>{fmt(t?.images)}</strong> imágenes</span>
        <span><strong>{fmt(t?.countries)}</strong> países</span>
      </p>
    </div>
  )
}

/** Escribe un país y ve directo a su guía. */
function CountryJump({ countries }: { countries: CountryRow[] }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const hits = useMemo(() => {
    const n = fold(q.trim())
    if (!n) return []
    return countries
      .filter((c) => c.groups > 0 && (fold(c.name_es ?? '').startsWith(n) || fold(c.name).startsWith(n) || fold(c.name_es ?? c.name).includes(n)))
      .sort((a, b) => b.groups - a.groups)
      .slice(0, 6)
  }, [q, countries])
  return (
    <div className="home-jump">
      <input
        className="input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && hits[0] && navigate(`/pais/${hits[0].code}`)}
        placeholder="Ir a un país: Hungría, Kenia, Chile…"
        aria-label="Ir a un país"
      />
      {hits.length > 0 && (
        <div className="home-jump-list">
          {hits.map((c) => (
            <Link key={c.code} to={`/pais/${c.code}`}>
              <span className="flag">{c.flag}</span> {c.name_es ?? c.name}
              <span className="muted small">{c.groups} pistas</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** Las secciones de la app, cada una con su imagen. */
function Sections() {
  // imágenes de ejemplo (respuestas en caché: una fila cada una)
  const mountain = useGeo('home-tile-montanas', () => geo.list({ family: 'montanas', photo: true, famous: true, sort: 'rank', limit: 1 }))
  const bollard = useGeo('home-tile-bolardo', () => guides.visual({ cat: 'bollards', cc: 'hu', limit: 1 }))
  const sign = useGeo('home-tile-senal', () => guides.visual({ cat: 'signs', cc: 'cz', limit: 1 }))
  const items: { to: string; title: string; text: string; img?: string; art?: string }[] = [
    { to: '/paises', title: 'Países', text: 'La guía de cada país, tema por tema', art: '🇭🇺🇯🇵🇧🇷🇰🇪🇨🇱🇮🇳🇿🇦🇳🇴' },
    { to: '/catalogo', title: 'Catálogo', text: 'Bolardos, postes, matrículas… de todo el mundo', img: bollard.data?.items[0]?.i },
    { to: '/duelo', title: 'Duelos', text: 'Los países que se confunden, foto contra foto', art: '🇭🇺 vs 🇸🇰' },
    { to: '/geografia', title: 'Geografía', text: 'Volcanes, ríos, ciudades y su terreno', img: mountain.data?.items[0]?.thumb },
    { to: '/buscar', title: '¿Dónde estoy?', text: 'Elige lo que ves y descarta países', img: sign.data?.items[0]?.i, art: '🔎' },
    { to: '/mapas', title: 'Mapas', text: 'Conducción, idiomas, líneas… en el mundo', art: '🗺️' },
  ]
  return (
    <section className="home-block">
      <div className="home-tiles">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="home-tile">
            <span className="home-tile-img">
              {it.img ? <Img src={it.img} sizes="(max-width: 600px) 46vw, 260px" /> : <span className="home-tile-art">{it.art}</span>}
            </span>
            <span className="home-tile-body">
              <strong>{it.title}</strong>
              <span>{it.text}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Por qué países empezar: los que más pistas tienen. */
function StartWith({ countries }: { countries: CountryRow[] }) {
  const top = useMemo(() => [...countries].filter((c) => c.groups > 0).sort((a, b) => b.groups - a.groups).slice(0, 12), [countries])
  if (!top.length) return null
  return (
    <section className="home-block">
      <div className="home-block-head">
        <h2>Empieza por</h2>
        <Link to="/paises">Todos los países →</Link>
      </div>
      <div className="home-row">
        {top.map((c) => (
          <Link key={c.code} to={`/pais/${c.code}`} className="home-country">
            <span className="flag">{c.flag}</span>
            <strong>{c.name_es ?? c.name}</strong>
            <span className="muted small">{c.essential} determinantes</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Los gemelos más famosos (los que más se confunden), con la clave en una frase. */
function FamousTwins() {
  const index = useJson<DuelIndex>('/community/duels.json')
  const map = useCountryMap()
  const top = useMemo(() => [...(index ?? [])].filter((d) => d.headline).sort((a, b) => b.score - a.score || b.diffs - a.diffs).slice(0, 6), [index])
  if (!top.length || !map.size) return null
  return (
    <section className="home-block">
      <div className="home-block-head">
        <h2>Gemelos famosos</h2>
        <Link to="/duelo">Todos los duelos →</Link>
      </div>
      <div className="home-row">
        {top.map((d) => (
          <Link key={`${d.a}_${d.b}`} to={`/duelo?a=${d.a}&b=${d.b}`} className="home-duel">
            <span className="home-duel-flags">{countryFlag(map, d.a)}<em>vs</em>{countryFlag(map, d.b)}</span>
            <strong>{countryLabel(map, d.a)} o {countryLabel(map, d.b)}</strong>
            <span className="home-duel-key">{d.headline}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Si ya estudias: lo de hoy primero (repasos, racha, objetivo y el país por el que seguir). */
function Today({ s, due }: { s: StudyState; due: number }) {
  const map = useCountryMap()
  const counts = scopeCounts(s)
  const today = reviewsToday(s)
  const goal = s.settings.data.goal
  const days = streak(s)
  // el país por el que seguir: el que tiene más pendiente de lo guardado o, si no, el más flojo
  const ccs = [...new Set(savedItems(s).map((i) => i.cc).filter((x): x is string => Boolean(x)))]
  const busiest = ccs.map((cc) => [cc, scopeCounts(s, { cc }).due] as const).sort((a, b) => b[1] - a[1])[0]
  const weakest = [...masteryByCountry(s).values()].filter((x) => x.cards >= 3).sort((a, b) => a.score - b.score)[0]
  const next = busiest && busiest[1] > 0 ? busiest[0] : weakest?.cc
  const pending = due + counts.newAvailable
  return (
    <section className="home-today">
      <div>
        <span className="eyebrow">Hoy</span>
        <h2>{pending > 0 ? `${pending} ${pending === 1 ? 'tarjeta' : 'tarjetas'} esperando` : 'Al día con tu repaso'}</h2>
        <p className="muted">
          {today}/{goal} repasos hoy{days > 0 ? ` · ${days} ${days === 1 ? 'día seguido' : 'días seguidos'}` : ''}
          {next ? <> · sigue con {countryFlag(map, next)} {countryLabel(map, next)}</> : null}
        </p>
      </div>
      <div className="row">
        <Link to="/entrenar" className="btn btn-primary btn-lg">{pending > 0 ? 'Repasar ahora' : 'Mi estudio'}</Link>
        {next && <Link to={`/pais/${next}`} className="btn btn-lg">Guía de {countryLabel(map, next)}</Link>}
      </div>
    </section>
  )
}
