import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { countryFlag, countryLabel, useCountryMap, type CountryRow } from '../../lib/data'
import { buildSession, cardsOf, inScope, scopeCounts, type CardSpec, type SessionScope } from '../../lib/study/cards'
import { isNew, retrievability, untilText } from '../../lib/study/fsrs'
import { accuracy, confusions, forecast, masteryByCountry, reviewsToday, streak } from '../../lib/study/stats'
import { deleteDeck, exportStudy, importStudy, liveDecks, renameDeck, savedItems, setNote, setSettings, unsaveItem, useStudy } from '../../lib/study/store'
import { lastSyncAt, syncNow, useSyncStatus } from '../../lib/study/sync'
import type { HintData, PhotoData, PlaceData, StudyItem } from '../../lib/study/types'
import { Img } from '../Img'

const WorldMap = lazy(() => import('../WorldMap'))
const StudySession = lazy(() => import('./StudySession'))

// Mi estudio: lo que has guardado con ☆, repasado con FSRS. Arriba lo de hoy; debajo tus
// mazos, lo guardado, la previsión, el dominio por país y los países que confundes.

const SIZES = [10, 20, 30, 50]
// dominio 0..1 → de rojo (lo olvidas) a verde (lo dominas)
const SCALE = ['#b4432f', '#c9793d', '#c9a43d', '#7fa35a', '#1f6b55']
const tone = (x: number) => SCALE[Math.min(SCALE.length - 1, Math.floor(x * SCALE.length))]
const pct = (x: number) => `${Math.round(x * 100)} %`
const dayName = (iso: string, i: number) => (i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'short' }))

export default function StudyHub({ initialDeck }: { initialDeck?: string }) {
  const s = useStudy()
  const map = useCountryMap()
  const [scope, setScope] = useState<SessionScope>(initialDeck ? { deck: initialDeck } : {})
  const [size, setSize] = useState(20)
  const [session, setSession] = useState<CardSpec[] | null>(null)
  // cada sesión es nueva (su cola y sus resultados empiezan de cero)
  const [run, setRun] = useState(0)

  const counts = scopeCounts(s, scope)
  const items = savedItems(s)
  const decks = liveDecks(s)

  const start = (sc: SessionScope = scope, extra = false) => {
    const cards = buildSession(s, sc, size, { extra })
    if (cards.length) {
      setScope(sc)
      setSession(cards)
      setRun((n) => n + 1)
      window.scrollTo(0, 0)
    }
  }

  if (!s.ready) return <div className="empty">Cargando tu estudio…</div>
  if (session) {
    return (
      <Suspense fallback={<div className="empty">Preparando…</div>}>
        <StudySession key={run} cards={session} onExit={() => setSession(null)} onAgain={() => start(scope, true)} />
      </Suspense>
    )
  }
  if (!items.length) return <Empty />

  const goal = s.settings.data.goal
  const today = reviewsToday(s)
  const days = streak(s)
  const pending = counts.due + counts.newAvailable
  // las que tocan más tarde hoy (pasos cortos de FSRS tras aprender o fallar)
  const laterToday = Math.max(0, forecast(s, 1)[0].n - counts.due)
  const scopeName = scope.deck ? s.decks[scope.deck]?.name : scope.cc ? countryLabel(map, scope.cc) : 'Todo'

  return (
    <div className="study-hub">
      <section className="study-today">
        <div className="study-today-main">
          <span className="eyebrow">Hoy · {scopeName}</span>
          <h2>{pending > 0 ? `${pending} ${pending === 1 ? 'tarjeta' : 'tarjetas'} para hoy` : 'Al día'}</h2>
          <p className="muted">
            {counts.due > 0 && <>{counts.due} toca repasar</>}
            {counts.due > 0 && counts.newAvailable > 0 && ' · '}
            {counts.newAvailable > 0 && <>{counts.newAvailable} nuevas</>}
            {pending === 0 && (laterToday > 0
              ? `${laterToday} ${laterToday === 1 ? 'vuelve' : 'vuelven'} más tarde hoy (lo recién aprendido se repasa a los pocos minutos).`
              : counts.fresh > 0
                ? `Ya empezaste las ${s.settings.data.newPerDay} nuevas de hoy. Quedan ${counts.fresh} para otros días.`
                : 'Nada pendiente: vuelve mañana o adelanta repasos.')}
          </p>
          <div className="row">
            <button className="btn btn-primary btn-lg" onClick={() => start(scope, pending === 0)}>
              {pending > 0 ? 'Estudiar ahora' : 'Adelantar repasos'}
            </button>
            <select className="select" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Tarjetas por sesión">
              {SIZES.map((n) => <option key={n} value={n}>{n} por sesión</option>)}
            </select>
            {(scope.deck || scope.cc) && <button className="btn btn-quiet" onClick={() => setScope({})}>Ver todo</button>}
          </div>
        </div>
        <div className="study-kpis">
          <div>
            <strong>{today}<small>/{goal}</small></strong>
            <span>repasos hoy</span>
            <span className="kpi-bar"><span style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} /></span>
          </div>
          <div><strong>{days}</strong><span>{days === 1 ? 'día seguido' : 'días seguidos'}</span></div>
          <div><strong>{items.length}</strong><span>guardados</span></div>
        </div>
        <SyncLine />
      </section>

      <Decks scope={scope} setScope={setScope} start={start} />
      <Saved scope={scope} />

      <div className="study-grid">
        <Forecast />
        <Accuracy />
      </div>
      <Mastery start={start} />
      <Confusions />
      <SettingsPanel />
      <p className="muted small" style={{ marginTop: '2rem' }}>
        <Link to="/entrenar?modo=libre">Práctica libre</Link>: preguntas al azar de todas las guías, sin guardar nada.
        {decks.length === 0 && ' Crea mazos desde ☆ Guardar para separar lo que estudias.'}
      </p>
    </div>
  )
}

function Empty() {
  return (
    <div className="study-empty">
      <h2>Guarda lo que quieras aprender</h2>
      <p>
        Toca <strong>☆ Guardar</strong> en una pista, una foto o un lugar, o <strong>Estudiar lo esencial</strong> en la guía de un país.
        Aquí lo repasarás con repetición espaciada: lo que fallas vuelve pronto; lo que dominas, cada vez más tarde.
      </p>
      <ul>
        <li><strong>Reconocer:</strong> ves la pista o la foto y eliges el país, con los países con los que se confunde.</li>
        <li><strong>Recordar:</strong> «Hungría · bolardos: ¿cómo son?», lo piensas y lo compruebas.</li>
        <li><strong>Ubicar:</strong> «¿Dónde está el lago Balatón?», tocas el mapa y cuenta la distancia.</li>
      </ul>
      <div className="row">
        <Link to="/paises" className="btn btn-primary">Elegir un país</Link>
        <Link to="/explorar" className="btn">Explorar fotos</Link>
        <Link to="/geografia" className="btn">Lugares</Link>
        <Link to="/entrenar?modo=libre" className="btn btn-quiet">Práctica libre</Link>
      </div>
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

function Decks({ scope, setScope, start }: { scope: SessionScope; setScope: (s: SessionScope) => void; start: (s: SessionScope) => void }) {
  const s = useStudy()
  const map = useCountryMap()
  const decks = liveDecks(s)
  const items = savedItems(s)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const byCountry = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) if (i.cc) m.set(i.cc, (m.get(i.cc) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [items])

  const mastery = (sc: SessionScope) => {
    let sum = 0
    let n = 0
    for (const it of items) {
      if (!inScope(it, sc)) continue
      for (const c of cardsOf(it)) {
        const st = s.cards[c.key]?.state
        n++
        if (!isNew(st)) sum += retrievability(st)
      }
    }
    return n ? sum / n : 0
  }
  const rows: { sc: SessionScope; name: string; id?: string }[] = [{ sc: {}, name: 'Todo lo guardado' }, ...decks.map((d) => ({ sc: { deck: d.id }, name: d.name, id: d.id }))]

  return (
    <section className="filter-group study-section">
      <h2>Mazos</h2>
      <ul className="deck-list">
        {rows.map(({ sc, name, id }) => {
          const c = scopeCounts(s, sc)
          const m = mastery(sc)
          const active = (scope.deck ?? '') === (sc.deck ?? '') && !scope.cc
          return (
            <li key={id ?? 'all'} className={active ? 'on' : ''}>
              <button className="deck-main" onClick={() => setScope(sc)}>
                {editing === id && id ? (
                  <input
                    className="input"
                    autoFocus
                    value={draft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => (renameDeck(id, draft), setEditing(null))}
                    onKeyDown={(e) => e.key === 'Enter' && (renameDeck(id, draft), setEditing(null))}
                  />
                ) : (
                  <strong>{name}</strong>
                )}
                <span className="muted small">{c.items} {c.items === 1 ? 'guardado' : 'guardados'} · {c.due} por repasar · {c.newAvailable} {c.newAvailable === 1 ? 'nueva' : 'nuevas'}</span>
                <span className="deck-bar" title={`Dominio ${pct(m)}`}><span style={{ width: `${m * 100}%`, background: tone(m) }} /></span>
              </button>
              <div className="deck-actions">
                <button className="btn" disabled={c.due + c.newAvailable === 0} onClick={() => start(sc)}>Estudiar</button>
                {id && (
                  <>
                    <button className="btn btn-quiet" onClick={() => (setEditing(id), setDraft(name))} aria-label={`Renombrar ${name}`}>Renombrar</button>
                    <button className="btn btn-quiet" onClick={() => confirm(`¿Borrar el mazo «${name}»? Lo guardado se queda en Mi estudio.`) && deleteDeck(id)} aria-label={`Borrar ${name}`}>Borrar</button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {byCountry.length > 1 && (
        <>
          <span className="eyebrow">Por país</span>
          <div className="chips">
            {byCountry.map(([cc, n]) => (
              <button key={cc} className={`chip ${scope.cc === cc ? 'on' : ''}`} onClick={() => setScope({ cc })}>
                {countryFlag(map, cc)} {countryLabel(map, cc)} <span className="muted">{n}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function itemTitle(i: StudyItem): string {
  if (i.kind === 'place') return (i.data as PlaceData).name
  if (i.kind === 'photo') return (i.data as PhotoData).catName ?? (i.data as PhotoData).cat
  return (i.data as HintData).text
}

function Saved({ scope }: { scope: SessionScope }) {
  const s = useStudy()
  const map = useCountryMap()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = savedItems(s)
    .filter((i) => inScope(i, scope))
    .filter((i) => !q || itemTitle(i).toLowerCase().includes(q.toLowerCase()) || i.note.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.created_at - a.created_at)
  return (
    <section className="filter-group study-section">
      <div className="row">
        <h2>Guardados</h2>
        <button className="link" onClick={() => setOpen(!open)}>{open ? 'Ocultar' : `Ver ${list.length}`}</button>
      </div>
      {open && (
        <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en lo guardado y tus notas" style={{ marginBottom: '0.8rem' }} />
          <ul className="saved-list">
            {list.slice(0, 200).map((i) => {
              const img = i.kind === 'photo' ? (i.data as PhotoData).img : i.kind === 'place' ? (i.data as PlaceData).thumb : (i.data as HintData).img
              const r = Math.max(...cardsOf(i).map((c) => retrievability(s.cards[c.key]?.state)))
              return (
                <li key={i.key}>
                  <span className="saved-img">{img ? <Img src={img} sizes="56px" /> : <span>{i.kind === 'place' ? '◎' : '¶'}</span>}</span>
                  <span className="saved-main">
                    <span className="saved-title">{itemTitle(i)}</span>
                    <span className="muted small">
                      {i.cc && <>{countryFlag(map, i.cc)} {countryLabel(map, i.cc)} · </>}
                      {i.kind === 'hint' ? (i.data as HintData).catName ?? 'Pista' : i.kind === 'photo' ? 'Foto' : (i.data as PlaceData).kindLabel ?? 'Lugar'}
                      {i.decks.length > 0 && <> · {i.decks.map((d) => s.decks[d]?.name).filter(Boolean).join(', ')}</>}
                      {r > 0 && <> · dominio {pct(r)}</>}
                    </span>
                    <NoteEdit item={i} />
                  </span>
                  <button className="btn btn-quiet" onClick={() => unsaveItem(i.key)} aria-label="Quitar">Quitar</button>
                </li>
              )
            })}
          </ul>
          {list.length > 200 && <p className="muted small">Se muestran 200 de {list.length}. Usa la búsqueda para encontrar el resto.</p>}
        </>
      )}
    </section>
  )
}

function NoteEdit({ item }: { item: StudyItem }) {
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState(item.note)
  if (!edit) {
    return (
      <button className="link saved-note" onClick={() => (setDraft(item.note), setEdit(true))}>
        {item.note ? `“${item.note}”` : '+ nota'}
      </button>
    )
  }
  return (
    <textarea
      className="input"
      rows={2}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (draft !== item.note && setNote(item.key, draft), setEdit(false))}
    />
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

function Confusions() {
  const s = useStudy()
  const map = useCountryMap()
  const list = useMemo(() => confusions(s).slice(0, 10), [s.reviews]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null
  return (
    <section className="filter-group study-section">
      <h2>Países que confundes</h2>
      <p className="muted small">Cuando respondes uno por otro. Salen antes como opción en tus preguntas, y en un duelo los ves lado a lado.</p>
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
            if (f) setMsg(importStudy(await f.text()) ? 'Copia importada.' : 'Ese archivo no es una copia de Mi estudio.')
            e.target.value = ''
          }}
        />
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </section>
  )
}
