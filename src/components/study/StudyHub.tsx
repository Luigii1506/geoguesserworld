import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { countryFlag, countryLabel, loadJson, useCountryMap, type CountryRow } from '../../lib/data'
import { buildSession, scopeCounts, SMART_DECKS, type CardSpec, type SessionScope } from '../../lib/study/cards'
import { isNew, untilText } from '../../lib/study/fsrs'
import { twinsItem } from '../../lib/study/items'
import { accuracy, calendar, confusions, forecast, masteryByCountry, masteryByTopic, reviewsToday, speed, streak } from '../../lib/study/stats'
import { exportStudy, importStudy, isSaved, saveItems, savedItems, setSettings, useStudy } from '../../lib/study/store'
import { ExamHistory } from './ExamSession'
import { lastSyncAt, syncNow, useSyncStatus } from '../../lib/study/sync'

const WorldMap = lazy(() => import('../WorldMap'))
const StudySession = lazy(() => import('./StudySession'))

// Entrenar: tres formas de practicar (repasar lo guardado con ☆, práctica libre, examen); debajo tus
// mazos, lo guardado, la previsión, el dominio por país y los países que confundes.

const SIZES = [10, 20, 30, 50]
// dominio 0..1 → de rojo (lo olvidas) a verde (lo dominas)
const SCALE = ['#b4432f', '#c9793d', '#c9a43d', '#7fa35a', '#1f6b55']
const tone = (x: number) => SCALE[Math.min(SCALE.length - 1, Math.floor(x * SCALE.length))]
const pct = (x: number) => `${Math.round(x * 100)} %`
const dayName = (iso: string, i: number) => (i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'short' }))

export default function StudyHub({ initialDeck, initialCountry, initialItem, autostart }: {
  initialDeck?: string
  initialCountry?: string
  initialItem?: string
  /** empezar la sesión al entrar (desde Guardados: «Repasar este mazo», «Repasar solo esto») */
  autostart?: boolean
}) {
  const s = useStudy()
  const map = useCountryMap()
  const [scope, setScope] = useState<SessionScope>(
    initialItem ? { item: initialItem } : initialDeck ? { deck: initialDeck } : initialCountry ? { cc: initialCountry } : {},
  )
  const [size, setSize] = useState(20)
  const [session, setSession] = useState<CardSpec[] | null>(null)
  // cada sesión es nueva (su cola y sus resultados empiezan de cero)
  const [run, setRun] = useState(0)

  const counts = scopeCounts(s, scope)
  const items = savedItems(s)

  const start = (sc: SessionScope = scope, extra = false) => {
    const cards = buildSession(s, sc, size, { extra })
    if (cards.length) {
      setScope(sc)
      setSession(cards)
      setRun((n) => n + 1)
      window.scrollTo(0, 0)
    }
  }
  // desde Guardados: la sesión empieza sola (una vez)
  const auto = useRef(autostart)
  useEffect(() => {
    if (!s.ready || !auto.current) return
    auto.current = false
    start(scope, true)
  }, [s.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.ready) return <div className="empty">Cargando tu estudio…</div>
  if (session) {
    return (
      <Suspense fallback={<div className="empty">Preparando…</div>}>
        <StudySession key={run} cards={session} onExit={() => setSession(null)} onAgain={() => start(scope, true)} />
      </Suspense>
    )
  }

  const goal = s.settings.data.goal
  const today = reviewsToday(s)
  const days = streak(s)
  const pending = counts.due + counts.newAvailable
  // las que tocan más tarde hoy (pasos cortos de FSRS tras aprender o fallar)
  const laterToday = Math.max(0, forecast(s, 1)[0].n - counts.due)
  const scoped = scope.item || scope.deck || scope.cc || scope.smart
  const scopeName = scope.item ? 'un guardado' : scope.smart ? SMART_DECKS.find((d) => d.id === scope.smart)?.name : scope.deck ? s.decks[scope.deck]?.name : scope.cc ? countryLabel(map, scope.cc) : ''
  const status = !items.length
    ? 'Aún no has guardado nada.'
    : pending > 0
      ? `${pending} ${pending === 1 ? 'tarjeta' : 'tarjetas'} para hoy${counts.due && counts.newAvailable ? ` (${counts.due} repasos, ${counts.newAvailable} nuevas)` : ''}`
      : laterToday > 0
        ? `Al día: ${laterToday} ${laterToday === 1 ? 'vuelve' : 'vuelven'} más tarde hoy.`
        : 'Al día: nada pendiente hasta mañana.'

  return (
    <div className="train-home">
      <header className="page-head">
        <h1>Entrenar</h1>
        <p className="lead">Tres formas de practicar. Lo que respondes se guarda en tu progreso.</p>
      </header>

      <div className="train-choices">
        <article className="train-choice train-choice-main">
          <span className="train-choice-icon" aria-hidden="true">★</span>
          <h2>Repasar lo guardado</h2>
          <p>Lo que marcaste con ☆ en guías, fotos y lugares. Lo que fallas vuelve pronto; lo que dominas, cada vez más tarde.</p>
          <p className="train-choice-stat">
            {status}
            {scoped && <> · solo <strong>{scopeName}</strong> <button className="link" onClick={() => setScope({})}>(ver todo)</button></>}
          </p>
          {items.length > 0 ? (
            <div className="row">
              <button className="btn btn-primary btn-lg" onClick={() => start(scope, pending === 0)}>
                {pending > 0 ? 'Repasar ahora' : 'Adelantar repasos'}
              </button>
              <select className="select" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Tarjetas por sesión">
                {SIZES.map((n) => <option key={n} value={n}>{n} tarjetas</option>)}
              </select>
              <Link to="/guardados" className="btn btn-quiet">Ver mis {items.length} guardados</Link>
            </div>
          ) : (
            <div className="row">
              <Link to="/guardados" className="btn btn-primary">Cómo guardar</Link>
              <Link to="/paises" className="btn btn-quiet">Ir a un país</Link>
            </div>
          )}
        </article>

        <article className="train-choice">
          <span className="train-choice-icon" aria-hidden="true">⟳</span>
          <h2>Práctica libre</h2>
          <p>Preguntas al azar de todas las guías: «¿de qué país es esta pista o esta foto?». No hace falta guardar nada.</p>
          <div className="row"><Link to="/entrenar?modo=libre" className="btn">Empezar</Link></div>
        </article>

        <article className="train-choice">
          <span className="train-choice-icon" aria-hidden="true">◷</span>
          <h2>Examen de un país</h2>
          <p>20 preguntas contra el reloj. No cambia tu repaso: sirve para medir cuánto has avanzado.</p>
          <ExamStart />
        </article>
      </div>

      {(items.length > 0 || s.reviews.length > 0) && (
        <section className="train-today">
          <div><strong>{today}<small>/{goal}</small></strong><span>repasos hoy</span><span className="kpi-bar"><span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} /></span></div>
          <div><strong>{days}</strong><span>{days === 1 ? 'día seguido' : 'días seguidos'}</span></div>
          <div><strong>{items.length}</strong><span>guardados</span></div>
          <SyncLine />
        </section>
      )}

      {s.reviews.length > 0 && (
        <details className="train-more">
          <summary>Tu progreso <span className="muted small">previsión, actividad, dominio por país, confusiones</span></summary>
          <div className="study-hub">
            <div className="study-grid">
              <Forecast />
              <Accuracy />
            </div>
            <Activity />
            <Mastery start={start} />
            <Topics />
            <Confusions />
            <Exams />
          </div>
        </details>
      )}
      <details className="train-more">
        <summary>Ajustes <span className="muted small">objetivo diario, nuevas al día, copia de seguridad</span></summary>
        <SettingsPanel />
      </details>
    </div>
  )
}

function SyncLine() {
  const status = useSyncStatus()
  if (status === 'off') return null
  const ago = lastSyncAt() ? untilText(new Date(), new Date(lastSyncAt())) : null
  const text = {
    idle: ago ? `Sincronizado con tu cuenta hace ${ago}` : 'Sincronizado con tu cuenta',
    syncing: 'Sincronizando…',
    offline: 'Sin conexión: tus repasos se guardan aquí y se enviarán al volver',
    error: 'No se pudo sincronizar; se reintentará',
  }[status]
  return (
    <p className={`sync-line sync-${status}`}>
      {text}
      {status === 'error' && <button className="link" onClick={() => void syncNow()}> Reintentar</button>}
    </p>
  )
}





function Forecast() {
  const s = useStudy()
  const days = forecast(s, 7)
  const max = Math.max(1, ...days.map((d) => d.n))
  return (
    <section className="filter-group study-section">
      <h2>Próximos días</h2>
      <div className="forecast">
        {days.map((d, i) => (
          <div key={d.day} className="forecast-day">
            <span className="forecast-n">{d.n}</span>
            <span className="forecast-bar"><span style={{ height: `${(d.n / max) * 100}%` }} /></span>
            <span className="muted small">{dayName(d.day, i)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Accuracy() {
  const s = useStudy()
  const a = accuracy(s, 30)
  const total = Object.values(s.cards).filter((c) => !isNew(c.state)).length
  return (
    <section className="filter-group study-section">
      <h2>Último mes</h2>
      <div className="stat-line study-stats">
        <div><strong>{a.n ? pct(a.ok / a.n) : '—'}</strong><span>aciertos</span></div>
        <div><strong>{a.n.toLocaleString('es')}</strong><span>respuestas</span></div>
        <div><strong>{total.toLocaleString('es')}</strong><span>tarjetas en marcha</span></div>
      </div>
    </section>
  )
}

function Mastery({ start }: { start: (s: SessionScope, extra?: boolean) => void }) {
  const s = useStudy()
  const map = useCountryMap()
  const m = useMemo(() => masteryByCountry(s), [s.cards, s.reviews]) // eslint-disable-line react-hooks/exhaustive-deps
  const countries = useMemo(() => [...map.values()], [map])
  const weak = [...m.values()].filter((x) => x.cards >= 3 && x.score < 0.85).sort((a, b) => a.score - b.score).slice(0, 6)
  if (!m.size) return null
  return (
    <section className="filter-group study-section">
      <h2>Dominio por país</h2>
      <p className="muted small">Probabilidad de que hoy te acuerdes de lo que has estudiado de cada país (FSRS).</p>
      <Suspense fallback={<div className="empty">Cargando mapa…</div>}>
        <WorldMap
          countries={countries}
          paint={(c: CountryRow) => (m.has(c.code) ? tone(m.get(c.code)!.score) : undefined)}
          card={(c: CountryRow) => (m.has(c.code) ? <span>Dominio {pct(m.get(c.code)!.score)} · {m.get(c.code)!.cards} tarjetas</span> : <span className="muted">Sin estudiar</span>)}
          legend={
            <div className="mastery-legend">
              <span>Lo olvidas</span>
              {SCALE.map((c) => <i key={c} style={{ background: c }} />)}
              <span>Lo dominas</span>
            </div>
          }
        />
      </Suspense>
      {weak.length > 0 && (
        <>
          <span className="eyebrow">Para reforzar</span>
          <div className="chips">
            {weak.map((w) => (
              <button key={w.cc} className="chip" onClick={() => start({ cc: w.cc }, true)} title="Estudiar este país">
                {countryFlag(map, w.cc)} {countryLabel(map, w.cc)} <span className="muted">{pct(w.score)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

type DuelIndex = { a: string; b: string; headline: string | null }[]

function Confusions() {
  const s = useStudy()
  const map = useCountryMap()
  const list = useMemo(() => confusions(s).slice(0, 10), [s.reviews]) // eslint-disable-line react-hooks/exhaustive-deps
  const [duels, setDuels] = useState<DuelIndex | null>(null)
  const [added, setAdded] = useState<number | null>(null)
  useEffect(() => {
    if (list.length) loadJson<DuelIndex>('/community/duels.json').then((d) => setDuels(d ?? []))
  }, [list.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps
  const duelOf = (a: string, b: string) => duels?.find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a))
  // tus confusiones que tienen duelo, como tarjetas de gemelos
  const asTwins = () => {
    const items = list.map((c) => duelOf(c.a, c.b)).filter((d): d is DuelIndex[number] => Boolean(d)).map((d) => twinsItem(d.a, d.b, d.headline))
    const fresh = items.filter((i) => !isSaved(s, i.key))
    saveItems(items)
    setAdded(fresh.length)
  }
  if (!list.length) return null
  return (
    <section className="filter-group study-section">
      <h2>Países que confundes</h2>
      <p className="muted small">Cuando respondes uno por otro. Salen antes como opción en tus preguntas, y en un duelo los ves lado a lado.</p>
      {duels && list.some((c) => duelOf(c.a, c.b)) && (
        <p className="row">
          <button className="btn" onClick={asTwins}>⇄ Estudiarlos como gemelos</button>
          {added !== null && <span className="muted small">{added ? `${added} parejas añadidas al mazo automático «Gemelos».` : 'Ya estaban en «Gemelos».'}</span>}
        </p>
      )}
      <ul className="confusion-list">
        {list.map((c) => (
          <li key={`${c.a}>${c.b}`}>
            <span>
              Era <strong>{countryFlag(map, c.a)} {countryLabel(map, c.a)}</strong> y dijiste <strong>{countryFlag(map, c.b)} {countryLabel(map, c.b)}</strong>
            </span>
            <span className="muted small">{c.n} {c.n === 1 ? 'vez' : 'veces'}</span>
            <Link to={`/duelo?a=${c.a}&b=${c.b}`} className="btn btn-quiet">Duelo →</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const LEVELS = [0, 1, 5, 15, 30]
function Activity() {
  const s = useStudy()
  const weeks = calendar(s, 20)
  const total = weeks.flat().reduce((n, d) => n + Math.max(0, d.n), 0)
  const active = weeks.flat().filter((d) => d.n > 0).length
  return (
    <section className="filter-group study-section">
      <h2>Actividad</h2>
      <p className="muted small">{total.toLocaleString('es')} repasos en {active} {active === 1 ? 'día' : 'días'} de las últimas 20 semanas.</p>
      <div className="activity" role="img" aria-label="Calendario de repasos">
        {weeks.map((w, i) => (
          <div key={i} className="activity-week">
            {w.map((d) => {
              const lvl = d.n < 0 ? -1 : LEVELS.filter((x) => d.n >= x).length - 1
              return <span key={d.day} className={`activity-day l${lvl}`} title={d.n >= 0 ? `${new Date(`${d.day}T12:00:00`).toLocaleDateString('es')}: ${d.n} repasos` : undefined} />
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

function Topics() {
  const s = useStudy()
  const list = useMemo(() => masteryByTopic(s), [s.cards, s.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const sp = useMemo(() => speed(s), [s.reviews]) // eslint-disable-line react-hooks/exhaustive-deps
  const map = useCountryMap()
  if (!list.length && !sp.n) return null
  return (
    <div className="study-grid">
      {list.length > 0 && (
        <section className="filter-group study-section">
          <h2>Por tema</h2>
          <ul className="topic-bars">
            {list.slice(0, 10).map((t) => (
              <li key={t.cat}>
                <span>{t.name}</span>
                <span className="deck-bar"><span style={{ width: `${t.score * 100}%`, background: tone(t.score) }} /></span>
                <span className="muted small num">{pct(t.score)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {sp.n > 0 && (
        <section className="filter-group study-section">
          <h2>Velocidad</h2>
          <div className="stat-line study-stats">
            <div><strong>{(sp.median / 1000).toFixed(1).replace('.', ',')} s</strong><span>para reconocer (mediana)</span></div>
            <div><strong>{sp.n}</strong><span>aciertos medidos</span></div>
          </div>
          {sp.slow.length > 0 && (
            <>
              <span className="eyebrow">Donde más tardas</span>
              <div className="chips">
                {sp.slow.map((x) => <span key={x.cc} className="chip">{countryFlag(map, x.cc)} {countryLabel(map, x.cc)} <span className="muted">{(x.median / 1000).toFixed(1).replace('.', ',')} s</span></span>)}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

/** El selector del examen en la tarjeta de Entrenar (el país más estudiado, por defecto). */
function ExamStart() {
  const s = useStudy()
  const map = useCountryMap()
  const navigate = useNavigate()
  const options = useMemo(() => [...map.values()].filter((c) => c.groups > 0).sort((a, b) => (a.name_es ?? a.name).localeCompare(b.name_es ?? b.name, 'es')), [map])
  const studied = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of savedItems(s)) if (i.cc) m.set(i.cc, (m.get(i.cc) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).map(([cc]) => cc)
  }, [s.items]) // eslint-disable-line react-hooks/exhaustive-deps
  const [cc, setCc] = useState('')
  const pick = cc || studied[0] || 'hu'
  return (
    <div className="row">
      <select className="select" value={pick} onChange={(e) => setCc(e.target.value)} aria-label="País del examen">
        {options.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name_es ?? c.name}</option>)}
      </select>
      <button className="btn" onClick={() => navigate(`/entrenar?examen=${pick}`)}>Empezar</button>
    </div>
  )
}

/** Historial de exámenes por país (en «Tu progreso»). */
function Exams() {
  const s = useStudy()
  const map = useCountryMap()
  const exams = s.settings.data.exams ?? []
  const recent = [...new Set(exams.slice().reverse().map((e) => e.cc))].slice(0, 8)
  if (!recent.length) return null
  return (
    <section className="filter-group study-section">
      <h2>Exámenes</h2>
      <div className="exam-recent">
        {recent.map((x) => {
          const last = exams.filter((e) => e.cc === x).at(-1)!
          return (
            <div key={x} className="exam-row">
              <span>{countryFlag(map, x)} {countryLabel(map, x)}</span>
              <ExamHistory cc={x} />
              <span className="muted small">última: {last.ok}/{last.n}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SettingsPanel() {
  const s = useStudy()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const { goal, newPerDay } = s.settings.data
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportStudy()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `geomastery-estudio-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="filter-group study-section">
      <h2>Ajustes</h2>
      <div className="row">
        <label className="setting-inline">
          <span className="muted small">Objetivo diario</span>
          <select className="select" value={goal} onChange={(e) => setSettings({ goal: Number(e.target.value) })}>
            {[10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n} repasos</option>)}
          </select>
        </label>
        <label className="setting-inline">
          <span className="muted small">Nuevas al día</span>
          <select className="select" value={newPerDay} onChange={(e) => setSettings({ newPerDay: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n} tarjetas</option>)}
          </select>
        </label>
      </div>
      <div className="row" style={{ marginTop: '0.8rem' }}>
        <button className="btn" onClick={download}>Descargar copia</button>
        <button className="btn btn-quiet" onClick={() => file.current?.click()}>Importar copia</button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setMsg(importStudy(await f.text()) ? 'Copia importada.' : 'Ese archivo no es una copia de GeoMastery.')
            e.target.value = ''
          }}
        />
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </section>
  )
}
