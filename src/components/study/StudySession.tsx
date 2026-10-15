import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { countryFlag, countryLabel, useCountryMap } from '../../lib/data'
import { kindLabel } from '../../lib/geoFormat'
import type { CardSpec } from '../../lib/study/cards'
import { preview, untilText } from '../../lib/study/fsrs'
import { distanceKm, maskText, pickDistractors, shuffle } from '../../lib/study/quiz'
import { confusedWith } from '../../lib/study/stats'
import { getStudy, reviewCard, useStudy } from '../../lib/study/store'
import type { Grade, HintData, PhotoData, PlaceData } from '../../lib/study/types'
import { Img } from '../Img'
import { Usefulness } from '../ui'
import { SaveButton } from './SaveButton'

const LocateMap = lazy(() => import('./LocateMap'))

// Una sesión de Mi estudio. Lo que se falla vuelve una vez al final de la sesión (además de
// mañana, como programe FSRS): así se cierra el día habiéndolo acertado.

const GRADE_LABEL: Record<Grade, string> = { 1: 'Otra vez', 2: 'Difícil', 3: 'Bien', 4: 'Fácil' }

/** Tolerancia al ubicar (km): la mitad de su extensión, o según el tipo si no se sabe. */
function tolerance(d: PlaceData): number {
  if (d.bbox) {
    const [w, s, e, n] = d.bbox
    return Math.max(25, Math.min(600, distanceKm([w, s], [e, n]) / 2))
  }
  const big = ['admin1', 'region', 'range', 'plain', 'plateau', 'desert', 'basin', 'river', 'ecoregion', 'ocean', 'sea', 'gulf', 'forest', 'wetland', 'delta', 'coast', 'peninsula']
  return big.includes(d.kind) ? 150 : ['urban', 'city', 'town'].includes(d.kind) ? 40 : 60
}
function locateGrade(km: number, tol: number): Grade {
  if (km <= tol / 3) return 4
  if (km <= tol) return 3
  if (km <= tol * 3) return 2
  return 1
}
const kmText = (km: number) => (km < 1 ? 'a menos de 1 km' : `a ${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km).toLocaleString('es')} km`)

export interface SessionResult {
  card: CardSpec
  grade: Grade
  answer?: string | null
}

export default function StudySession({ cards, onExit, onAgain }: { cards: CardSpec[]; onExit: () => void; onAgain: () => void }) {
  const map = useCountryMap()
  const [queue, setQueue] = useState(cards)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const requeued = useRef(new Set<string>())

  const finish = (spec: CardSpec, grade: Grade, extra: { answer?: string | null; ms: number }) => {
    reviewCard(spec.key, grade, { cc: spec.item.cc, answer: extra.answer ?? null, ms: extra.ms })
    setResults((r) => [...r, { card: spec, grade, answer: extra.answer }])
  }
  const next = (spec: CardSpec, grade: Grade) => {
    // lo fallado vuelve una vez más al final
    if (grade === 1 && !requeued.current.has(spec.key)) {
      requeued.current.add(spec.key)
      setQueue((q) => [...q, spec])
    }
    setIdx((i) => i + 1)
  }

  if (!map.size) return <div className="empty">Preparando…</div>
  if (idx >= queue.length) return <Summary results={results} onExit={onExit} onAgain={onAgain} />

  const spec = queue[idx]
  return (
    <div className="page-narrow study">
      <div className="row">
        <span className="muted small num">{idx + 1} / {queue.length}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn btn-quiet" onClick={onExit}>Salir</button>
      </div>
      <div className="train-progress"><span style={{ width: `${(idx / queue.length) * 100}%` }} /></div>
      <Card key={`${spec.key}|${idx}`} spec={spec} onRated={(g, extra) => finish(spec, g, extra)} onNext={(g) => next(spec, g)} />
    </div>
  )
}

function Card({ spec, onRated, onNext }: { spec: CardSpec; onRated: (g: Grade, extra: { answer?: string | null; ms: number }) => void; onNext: (g: Grade) => void }) {
  if (spec.type === 'locate') return <LocateCard spec={spec} onRated={onRated} onNext={onNext} />
  if (spec.type === 'recall') return <RecallCard spec={spec} onRated={onRated} onNext={onNext} />
  return <ChoiceCard spec={spec} onRated={onRated} onNext={onNext} />
}

type CardProps = { spec: CardSpec; onRated: (g: Grade, extra: { answer?: string | null; ms: number }) => void; onNext: (g: Grade) => void }

/** Botones de nota con cuándo vuelve la tarjeta según cada una. */
function Grades({ cardKey, grades, onPick }: { cardKey: string; grades: Grade[]; onPick: (g: Grade) => void }) {
  const s = useStudy()
  const when = useMemo(() => preview(s.cards[cardKey]?.state), [cardKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grades">
      {grades.map((g) => (
        <button key={g} className={`btn grade grade-${g} ${g === 3 ? 'btn-primary' : ''}`} onClick={() => onPick(g)}>
          <span>{GRADE_LABEL[g]}</span>
          <small>{untilText(when[g])}</small>
        </button>
      ))}
    </div>
  )
}

function Note({ spec }: { spec: CardSpec }) {
  const s = useStudy()
  const note = s.items[spec.item.key]?.note
  return note ? <p className="study-note"><span className="eyebrow">Tu nota</span> {note}</p> : null
}

function Header({ spec, label }: { spec: CardSpec; label: string }) {
  const d = spec.item.data as HintData & PhotoData & PlaceData
  const cat = spec.item.kind === 'place' ? d.kindLabel ?? kindLabel(d.kind) : d.catName ?? d.cat
  return (
    <div className="row">
      <span className="eyebrow">{label}{cat ? ` · ${cat}` : ''}{d.sub ? ` · ${d.sub.replace(/_/g, ' ')}` : ''}</span>
      {spec.item.kind === 'hint' && d.u ? <Usefulness value={d.u} /> : null}
      <span className="spacer" style={{ flex: 1 }} />
      <SaveButton compact item={{ key: spec.item.key, kind: spec.item.kind, cc: spec.item.cc, data: spec.item.data }} />
    </div>
  )
}

/** Reconocer: ¿de qué país es? */
function ChoiceCard({ spec, onRated, onNext }: CardProps) {
  const map = useCountryMap()
  const started = useRef(Date.now())
  const cc = spec.item.cc!
  const country = map.get(cc)
  const options = useMemo(() => {
    const pool = new Set([...map.keys()])
    return shuffle([cc, ...pickDistractors(cc, pool, map, confusedWith(getStudy(), cc))])
  }, [cc, map])
  const [picked, setPicked] = useState<string | null>(null)
  const answered = picked !== null
  const correct = picked === cc
  const d = spec.item.data

  const pick = (code: string) => {
    if (answered) return
    setPicked(code)
    // fallo: nota automática; acierto: la elige quien estudia
    if (code !== cc) onRated(1, { answer: code, ms: Date.now() - started.current })
  }

  return (
    <div className="question">
      <Header spec={spec} label={spec.item.kind === 'place' ? 'Lugar' : spec.item.kind === 'photo' ? 'Foto' : 'Pista'} />
      {spec.item.kind === 'hint' && (
        <>
          <h2>¿De qué país es esta pista?</h2>
          <p className="question-text">{answered ? (d as HintData).text : maskText((d as HintData).text, country?.mask ?? [])}</p>
          {(d as HintData).img && answered && <Img className="question-img" src={(d as HintData).img!} size="img" sizes="(max-width: 700px) 92vw, 640px" />}
        </>
      )}
      {spec.item.kind === 'photo' && (
        <>
          <h2>¿De qué país es esta foto?</h2>
          <Img className="question-img" src={(d as PhotoData).img} size="img" sizes="(max-width: 700px) 92vw, 640px" loading="eager" />
          {answered && (d as PhotoData).text && <p className="question-text">{(d as PhotoData).text}</p>}
        </>
      )}
      {spec.item.kind === 'place' && (
        <>
          <h2>¿En qué país está?</h2>
          {(d as PlaceData).thumb && <Img className="question-img" src={(d as PlaceData).thumb!} size="img" sizes="(max-width: 700px) 92vw, 640px" loading="eager" />}
          {answered && <p className="question-text"><strong>{(d as PlaceData).name}.</strong> {(d as PlaceData).descr}</p>}
        </>
      )}

      <div className="answers">
        {options.map((code) => (
          <button
            key={code}
            className={`answer ${answered && code === cc ? 'right' : ''} ${answered && code === picked && !correct ? 'wrong' : ''}`}
            disabled={answered}
            onClick={() => pick(code)}
          >
            <span className="flag">{countryFlag(map, code)}</span> {countryLabel(map, code)}
          </button>
        ))}
      </div>

      {answered && (
        <div className="feedback">
          <p>
            <strong>{correct ? 'Correcto.' : `Era ${countryLabel(map, cc)}.`}</strong>{' '}
            {!correct && picked && <>Lo has confundido con {countryLabel(map, picked)}: se tendrá en cuenta. </>}
            <Link to={`/pais/${cc}`}>Guía de {countryLabel(map, cc)}</Link>
          </p>
          <Note spec={spec} />
          {correct ? (
            <Grades cardKey={spec.key} grades={[2, 3, 4]} onPick={(g) => (onRated(g, { answer: cc, ms: Date.now() - started.current }), onNext(g))} />
          ) : (
            <div><button className="btn btn-primary" onClick={() => onNext(1)}>Siguiente</button></div>
          )}
        </div>
      )}
    </div>
  )
}

/** Recordar: piensa cómo es y compruébalo (Anki). */
function RecallCard({ spec, onRated, onNext }: CardProps) {
  const map = useCountryMap()
  const started = useRef(Date.now())
  const [shown, setShown] = useState(false)
  const cc = spec.item.cc
  const d = spec.item.data as HintData & PhotoData
  const where = cc ? `${countryFlag(map, cc)} ${countryLabel(map, cc)}` : ''
  const topic = (d.catName ?? d.cat ?? '').toLowerCase()

  return (
    <div className="question">
      <Header spec={spec} label="Recuerda" />
      <h2>{where}{topic ? ` · ${topic}` : ''}{d.sub ? ` (${d.sub.replace(/_/g, ' ')})` : ''}</h2>
      <p className="muted">{spec.item.kind === 'photo' ? '¿Cómo es? Imagínalo antes de verlo.' : '¿Qué pista es? Piénsala antes de verla.'}{d.region ? ` Región: ${d.region}.` : ''}</p>
      {!shown ? (
        <div className="recall-front">
          <button className="btn btn-primary btn-lg" onClick={() => setShown(true)}>Mostrar</button>
        </div>
      ) : (
        <>
          {d.text && <p className="question-text">{d.text}</p>}
          {d.img && <Img className="question-img" src={d.img} size="img" sizes="(max-width: 700px) 92vw, 640px" loading="eager" />}
          <div className="feedback">
            <Note spec={spec} />
            <span className="muted small">¿Lo recordabas?</span>
            <Grades cardKey={spec.key} grades={[1, 2, 3, 4]} onPick={(g) => (onRated(g, { ms: Date.now() - started.current }), onNext(g))} />
          </div>
        </>
      )}
    </div>
  )
}

/** Ubicar: clic donde crees que está. */
function LocateCard({ spec, onRated, onNext }: CardProps) {
  const map = useCountryMap()
  const started = useRef(Date.now())
  const d = spec.item.data as PlaceData
  const cc = spec.item.cc
  const country = cc ? map.get(cc) : undefined
  const [guess, setGuess] = useState<[number, number] | null>(null)
  const [result, setResult] = useState<{ km: number; grade: Grade } | null>(null)
  const tol = tolerance(d)

  const confirm = () => {
    if (!guess) return
    const km = distanceKm(guess, [d.lng, d.lat])
    const grade = locateGrade(km, tol)
    setResult({ km, grade })
    onRated(grade, { ms: Date.now() - started.current })
  }

  return (
    <div className="question">
      <Header spec={spec} label="Ubica" />
      <h2>¿Dónde está {d.name}?</h2>
      <p className="muted">{d.kindLabel ?? kindLabel(d.kind)}{country ? ` en ${country.flag ?? ''} ${country.name_es ?? country.name}` : ''}. Toca el mapa; puedes acercarlo.</p>
      <Suspense fallback={<div className="locate locate-loading" />}>
        <LocateMap focusCcn3={country?.ccn3} guess={guess} onGuess={setGuess} answer={result ? [d.lng, d.lat] : null} />
      </Suspense>
      {!result ? (
        <div className="row" style={{ marginTop: '0.8rem' }}>
          <button className="btn btn-primary btn-lg" disabled={!guess} onClick={confirm}>Confirmar</button>
          <span className="muted small">{guess ? 'Puedes mover el punto antes de confirmar.' : 'Marca un punto.'}</span>
        </div>
      ) : (
        <div className="feedback">
          <p>
            <strong>{result.grade >= 3 ? '¡Bien ubicado!' : result.grade === 2 ? 'Cerca.' : 'Lejos.'}</strong> Tu punto está {kmText(result.km)} de {d.name}
            {' '}(cuenta como acierto a menos de {Math.round(tol)} km).
          </p>
          {d.descr && <p className="muted small">{d.descr}</p>}
          <Note spec={spec} />
          <div><button className="btn btn-primary" onClick={() => onNext(result.grade)}>Siguiente</button></div>
        </div>
      )}
    </div>
  )
}

function Summary({ results, onExit, onAgain }: { results: SessionResult[]; onExit: () => void; onAgain: () => void }) {
  const map = useCountryMap()
  // la última respuesta de cada tarjeta (lo repetido al final cuenta una vez)
  const last = new Map(results.map((r) => [r.card.key, r]))
  const list = [...last.values()]
  const ok = list.filter((r) => r.grade >= 2).length
  const first = new Map<string, SessionResult>()
  for (const r of results) if (!first.has(r.card.key)) first.set(r.card.key, r)
  const missed = [...first.values()].filter((r) => r.grade === 1)
  const mixups = missed.filter((r) => r.answer && r.card.item.cc && r.answer !== r.card.item.cc)
  return (
    <div className="page-narrow">
      <header className="page-head">
        <span className="eyebrow">Sesión terminada</span>
        <h1>{ok} de {list.length}</h1>
        <p className="lead">
          {missed.length === 0
            ? 'Todo a la primera. FSRS espaciará estas tarjetas: volverán justo antes de que se te olviden.'
            : `${missed.length} ${missed.length === 1 ? 'tarjeta volvió' : 'tarjetas volvieron'} al final de la sesión y mañana saldrán de nuevo.`}
        </p>
      </header>
      {mixups.length > 0 && (
        <div className="filter-group" style={{ marginBottom: '1.6rem' }}>
          <span className="eyebrow">Hoy has confundido</span>
          <div className="chips">
            {mixups.map((r) => (
              <Link key={r.card.key} to={`/duelo?a=${r.card.item.cc}&b=${r.answer}`} className="chip">
                {countryFlag(map, r.card.item.cc!)} {countryLabel(map, r.card.item.cc!)} ↔ {countryFlag(map, r.answer!)} {countryLabel(map, r.answer!)}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="row">
        <button className="btn btn-primary btn-lg" onClick={onAgain}>Otra sesión</button>
        <button className="btn btn-lg" onClick={onExit}>Volver a Mi estudio</button>
      </div>
    </div>
  )
}
