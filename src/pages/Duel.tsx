import { useEffect, useMemo, useRef, useState } from 'react'
import { SaveButton } from '../components/study/SaveButton'
import { twinsItem } from '../lib/study/items'
import { Link, useSearchParams } from 'react-router-dom'
import { type CountryRow, useCountryMap, useJson } from '../lib/data'
import { imageSrc } from '../lib/images'
import { Lightbox, Loading, MissingData } from '../components/ui'
import { Img } from '../components/Img'

// Duelo entre gemelos: los países que más se confunden, enfrentados en fotos.
// Como una historia: el problema (se confunden), la guía (la clave en una
// frase), el plan (mira las diferencias → ponte a prueba) y el éxito (tu
// puntuación). Sin parámetros, muestra todas las parejas para elegir.

type Side = { img: string | null; more: string[]; text: string; region: string | null } | null
type DuelTopic = { key: string; label: string; a: Side; b: Side; same: boolean | null; diff: string | null }
type QuizItem = { img: string; topic: string; text: string }
type DuelFile = { a: string; b: string; headline: string | null; topics: DuelTopic[]; quiz: Record<string, QuizItem[]> }
type DuelIndex = { a: string; b: string; score: number; headline: string | null; diffs: number }[]

const ROUNDS = 10
const nameOf = (c?: CountryRow) => c?.name_es ?? c?.name ?? ''

/** Las tarjetas aparecen con un leve ascenso al entrar en pantalla (se revisa en cada render: los datos llegan por partes). */
function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('.reveal:not(.in)')]
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
      { rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  })
}

function jump(id: string) {
  const el = document.getElementById(id)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' })
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** ¿Cuál es? Una foto, dos países: diez rondas y tu puntuación. */
function Quiz({ duel, A, B }: { duel: DuelFile; A: CountryRow; B: CountryRow }) {
  const build = () => {
    const pa = shuffle(duel.quiz[A.code] ?? []).map((q) => ({ ...q, cc: A.code }))
    const pb = shuffle(duel.quiz[B.code] ?? []).map((q) => ({ ...q, cc: B.code }))
    const half = Math.ceil(ROUNDS / 2)
    return shuffle([...pa.slice(0, half), ...pb.slice(0, ROUNDS - Math.min(half, pa.length))]).slice(0, ROUNDS)
  }
  const [rounds, setRounds] = useState(build)
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<string[]>([])
  useEffect(() => {
    setRounds(build())
    setI(0)
    setAnswer(null)
    setScore(0)
    setMissed([])
  }, [duel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (rounds.length < 4) return <p className="muted">No hay suficientes fotos de estos dos países para un quiz.</p>
  const done = i >= rounds.length
  if (done) {
    const pct = score / rounds.length
    const topics = [...new Set(missed)]
    return (
      <div className="dq-end">
        <div className="dq-score"><strong>{score}</strong><span>/ {rounds.length}</span></div>
        <h3>{pct >= 0.9 ? 'Ya no los confundes.' : pct >= 0.7 ? 'Vas muy bien.' : 'Todavía se te cruzan.'}</h3>
        <p className="muted">
          {topics.length ? `Repasa: ${topics.join(', ')}.` : `Distingues ${nameOf(A)} de ${nameOf(B)} a la primera.`}
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => { setRounds(build()); setI(0); setAnswer(null); setScore(0); setMissed([]) }}>Otra ronda</button>
          <Link className="btn" to={`/pais/${A.code}`}>Guía de {nameOf(A)}</Link>
          <Link className="btn" to={`/pais/${B.code}`}>Guía de {nameOf(B)}</Link>
        </div>
      </div>
    )
  }
  const q = rounds[i]
  const choose = (cc: string) => {
    if (answer) return
    setAnswer(cc)
    if (cc === q.cc) setScore((s) => s + 1)
    else setMissed((m) => [...m, q.topic])
  }
  const right = answer && answer === q.cc
  return (
    <div className="dq">
      <div className="dq-progress"><span style={{ width: `${(i / rounds.length) * 100}%` }} /></div>
      <div className="dq-meta"><span>Foto {i + 1} de {rounds.length}</span><span>{score} aciertos</span></div>
      <div className={`dq-photo ${answer ? (right ? 'ok' : 'ko') : ''}`}>
        <img key={q.img} src={imageSrc(q.img)} alt="" />
      </div>
      <div className="dq-choices">
        {[A, B].map((c) => (
          <button
            key={c.code}
            className={`dq-choice ${answer ? (c.code === q.cc ? 'ok' : answer === c.code ? 'ko' : 'dim') : ''}`}
            onClick={() => choose(c.code)}
          >
            <span className="flag">{c.flag}</span>{nameOf(c)}
          </button>
        ))}
      </div>
      {answer && (
        <div className={`dq-feedback ${right ? 'ok' : 'ko'}`}>
          <strong>{right ? '¡Bien!' : `Era ${nameOf(q.cc === A.code ? A : B)}.`}</strong> <span className="eyebrow">{q.topic}</span>
          <p>{q.text}</p>
          <button className="btn btn-primary" onClick={() => { setI(i + 1); setAnswer(null) }}>
            {i + 1 < rounds.length ? 'Siguiente foto' : 'Ver resultado'}
          </button>
        </div>
      )}
    </div>
  )
}

function SidePhoto({ side, c, onOpen }: { side: Side; c: CountryRow; onOpen: (imgs: string[], caption: string) => void }) {
  return (
    <figure className="dd-side">
      <figcaption><span className="flag">{c.flag}</span>{nameOf(c)}{side?.region ? <em> · {side.region}</em> : null}</figcaption>
      {side?.img ? (
        <button className="dd-img" onClick={() => onOpen([side.img!, ...side.more], `${c.flag} ${nameOf(c)} · ${side.text}`)} aria-label="Ampliar">
          <Img src={side.img} sizes="(max-width: 700px) 46vw, 420px" />
        </button>
      ) : (
        <div className="dd-img dd-noimg">{side ? side.text : 'Sin pistas de este tema'}</div>
      )}
    </figure>
  )
}

/** Sin pareja elegida: todas las parejas de gemelos. */
function DuelPicker({ index, map }: { index: DuelIndex; map: Map<string, CountryRow> }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const list = index.filter((d) => !needle || `${nameOf(map.get(d.a))} ${nameOf(map.get(d.b))}`.toLowerCase().includes(needle))
  useReveal()
  return (
    <div className="duel">
      <header className="dp-hero">
        <span className="eyebrow">Duelos</span>
        <h1>¿Cuál es cuál?</h1>
        <p className="lead">
          Los gemelos son donde más puntos se pierden. Elige una pareja: verás sus diferencias en fotos y te pondrás a prueba en dos minutos.
        </p>
        <input className="input dp-search" placeholder="Busca un país: Eslovenia, Kenia, Uruguay…" value={q} onChange={(e) => setQ(e.target.value)} />
      </header>
      <div className="dp-grid">
        {list.slice(0, 120).map((d) => {
          const a = map.get(d.a)
          const b = map.get(d.b)
          if (!a || !b) return null
          return (
            <Link key={`${d.a}_${d.b}`} to={`/duelo?a=${d.a}&b=${d.b}`} className="dp-card reveal">
              <div className="dp-flags"><span>{a.flag}</span><em>vs</em><span>{b.flag}</span></div>
              <strong>{nameOf(a)} · {nameOf(b)}</strong>
              {d.headline && <p>{d.headline}</p>}
              <span className="dp-n">{d.diffs} diferencias</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function Duel() {
  const [params] = useSearchParams()
  const map = useCountryMap()
  const index = useJson<DuelIndex>('/community/duels.json')
  const a = params.get('a') ?? ''
  const b = params.get('b') ?? ''
  const key = a && b ? [a, b].sort().join('_') : null
  const duel = useJson<DuelFile>(key ? `/community/duel/${key}.json` : null)
  const [box, setBox] = useState<{ images: string[]; caption: string } | null>(null)
  const [showSame, setShowSame] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  useReveal()

  const related = useMemo(
    () => (index ?? []).filter((d) => (d.a === a || d.b === a || d.a === b || d.b === b) && `${d.a}_${d.b}` !== key).slice(0, 8),
    [index, a, b, key],
  )

  if (!map.size || index === undefined) return <Loading what="los duelos" />
  if (!index) return <MissingData />
  if (!key) return <DuelPicker index={index} map={map} />
  if (duel === undefined) return <Loading what="el duelo" />
  const A = map.get(a)
  const B = map.get(b)
  if (!duel || !A || !B) return <div className="empty">No hay duelo para esta pareja. <Link to="/duelo">Elige otra</Link>.</div>

  // los lados del archivo van en orden alfabético de código: se colocan según la URL
  const flip = duel.a !== A.code
  const sideA = (t: DuelTopic) => (flip ? t.b : t.a)
  const sideB = (t: DuelTopic) => (flip ? t.a : t.b)
  const diffs = duel.topics.filter((t) => t.diff)
  const unknown = duel.topics.filter((t) => !t.diff && t.same === null)
  const same = duel.topics.filter((t) => t.same)
  const open = (images: string[], caption: string) => setBox({ images, caption })

  return (
    <div className="duel" ref={top}>
      <nav className="crumbs"><Link to="/duelo">Duelos</Link> / {nameOf(A)} vs {nameOf(B)}</nav>

      {/* ── el problema y la clave ── */}
      <header className="dd-hero">
        <div className="dd-vs">
          <Link to={`/pais/${A.code}`} className="dd-country"><span className="flag">{A.flag}</span><strong>{nameOf(A)}</strong></Link>
          <span className="dd-vs-mark">vs</span>
          <Link to={`/pais/${B.code}`} className="dd-country"><span className="flag">{B.flag}</span><strong>{nameOf(B)}</strong></Link>
        </div>
        <p className="lead">Se confunden a menudo. Estas son las diferencias que de verdad los separan.</p>
        {duel.headline && (
          <blockquote className="dd-key">
            <span className="eyebrow">La clave</span>
            {duel.headline}
          </blockquote>
        )}
        <div className="dd-save">
          <SaveButton item={twinsItem(A.code, B.code, duel.headline)} />
          <span className="muted small">Guárdalo y repásalo foto contra foto desde Guardados.</span>
        </div>
        <ol className="dd-plan">
          <li><button onClick={() => jump('diferencias')}><span>1</span>Mira las {diffs.length} diferencias</button></li>
          <li><button onClick={() => jump('quiz')}><span>2</span>Ponte a prueba</button></li>
          <li><span className="dd-plan-done"><span>3</span>Ya no los confundes</span></li>
        </ol>
      </header>

      {/* ── 1 · diferencias ── */}
      <section id="diferencias" className="dd-section">
        <h2><span className="cg-num">1</span>Así se distinguen</h2>
        <div className="dd-list">
          {[...diffs, ...unknown].map((t) => (
            <article key={t.key} className="dd-topic reveal">
              <header>
                <span className="eyebrow">{t.label}</span>
              </header>
              <div className="dd-pair">
                <SidePhoto side={sideA(t)} c={A} onOpen={open} />
                <SidePhoto side={sideB(t)} c={B} onOpen={open} />
              </div>
              {t.diff ? <p className="dd-diff">{t.diff}</p> : <p className="dd-diff dd-diff-muted">Compara las fotos: no tenemos una diferencia redactada para este tema.</p>}
            </article>
          ))}
        </div>
        {same.length > 0 && (
          <div className="dd-same">
            <button className="link" onClick={() => setShowSame(!showSame)}>
              {showSame ? 'Ocultar' : `Lo que comparten (${same.length})`} · no te sirve para distinguirlos
            </button>
            {showSame && (
              <div className="dd-same-grid">
                {same.map((t) => (
                  <article key={t.key} className="dd-topic dd-topic-small">
                    <span className="eyebrow">{t.label}</span>
                    <div className="dd-pair">
                      <SidePhoto side={sideA(t)} c={A} onOpen={open} />
                      <SidePhoto side={sideB(t)} c={B} onOpen={open} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 2 · ponte a prueba ── */}
      <section id="quiz" className="dd-section">
        <h2><span className="cg-num">2</span>¿Cuál es?</h2>
        <p className="muted">Una foto real, dos países. Diez rondas.</p>
        <Quiz duel={duel} A={A} B={B} />
      </section>

      {related.length > 0 && (
        <section className="dd-section">
          <h2>Otros duelos</h2>
          <div className="dd-related">
            {related.map((d) => {
              const x = map.get(d.a)
              const y = map.get(d.b)
              return x && y ? (
                <Link key={`${d.a}_${d.b}`} to={`/duelo?a=${d.a}&b=${d.b}`} className="chip">
                  {x.flag} {nameOf(x)} vs {y.flag} {nameOf(y)}
                </Link>
              ) : null
            })}
          </div>
        </section>
      )}

      {box && <Lightbox images={box.images} index={0} onClose={() => setBox(null)} caption={<span className="fx-lb-caption">{box.caption}</span>} />}
    </div>
  )
}
