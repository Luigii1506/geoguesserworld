import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { countryFlag, countryLabel, useCountryMap, useMeta, type QuizPhoto, type QuizText } from '../../lib/data'
import { guides } from '../../lib/guides'
import { useLang } from '../../lib/i18n'
import { imageSrc } from '../../lib/images'
import { maskText, pickDistractors, shuffle } from '../../lib/study/quiz'
import { addExam, useStudy } from '../../lib/study/store'
import { DataError } from '../ui'

// Examen de un país: 20 preguntas al azar de su guía (pistas y fotos), contra el reloj y sin
// tocar el repaso (no cambia ninguna tarjeta). Sirve para medir el progreso: la nota y el
// tiempo quedan en el historial ("Hungría: 12/20 → 17/20").

const SIZE = 20

type Q = { kind: 'text' | 'photo'; cc: string; data: QuizText | QuizPhoto; options: string[] }

export default function ExamSession({ cc, onExit }: { cc: string; onExit: () => void }) {
  const map = useCountryMap()
  const meta = useMeta()
  const lang = useLang()
  const [qs, setQs] = useState<Q[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [ok, setOk] = useState(0)
  const t0 = useRef(0)
  const [secs, setSecs] = useState(0)
  const done = qs !== null && idx >= qs.length

  useEffect(() => {
    if (!map.size) return
    guides
      .quiz({ mode: 'mix', scope: `c:${cc}`, essential: false, category: '', size: SIZE, due: [], seen: [] })
      .then((r) => {
        const pool = new Set(r.pools.text ?? [...map.keys()])
        setQs(
          shuffle(r.items).map((it) => ({
            kind: it.kind,
            cc: it.cc,
            data: it.data as unknown as QuizText | QuizPhoto,
            options: shuffle([it.cc, ...pickDistractors(it.cc, new Set(r.pools[it.pool] ?? pool), map)]),
          })),
        )
        t0.current = Date.now()
      })
      .catch((e: Error) => setError(e.message))
  }, [cc, map])

  // reloj
  useEffect(() => {
    if (!qs || done) return
    const t = window.setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 500)
    return () => window.clearInterval(t)
  }, [qs, done])

  // al terminar, se guarda en el historial (una vez)
  const saved = useRef(false)
  useEffect(() => {
    if (done && qs && qs.length && !saved.current) {
      saved.current = true
      addExam({ cc, ok, n: qs.length, secs: Math.round((Date.now() - t0.current) / 1000) })
    }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (code: string) => {
    if (picked || !qs) return
    setPicked(code)
    if (code === qs[idx].cc) setOk((n) => n + 1)
    // avanza solo: en un examen no se puntúa cada pregunta
    window.setTimeout(() => {
      setPicked(null)
      setIdx((i) => i + 1)
    }, code === qs[idx].cc ? 650 : 1500)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (qs && !done && qs[idx]?.options[i]) answer(qs[idx].options[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const name = countryLabel(map, cc)
  if (error) return <DataError error={error} what="el examen" />
  if (!qs) return <div className="empty">Preparando el examen de {name}…</div>
  if (!qs.length) return <div className="empty">No hay preguntas de {name} todavía. <button className="link" onClick={onExit}>Volver</button></div>
  if (done) return <ExamSummary cc={cc} ok={ok} n={qs.length} secs={secs} onExit={onExit} />

  const q = qs[idx]
  const text = q.kind === 'text' ? (lang === 'es' ? (q.data as QuizText).es : (q.data as QuizText).en) : ''
  const catName = meta?.categories.find((c) => c.id === q.data.k)?.name ?? q.data.k
  return (
    <div className="page-narrow study">
      <div className="row">
        <span className="eyebrow">Examen · {countryFlag(map, cc)} {name}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="exam-clock num">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
        <span className="muted small num">{idx + 1} / {qs.length}</span>
        <button className="btn btn-quiet" onClick={onExit}>Salir</button>
      </div>
      <div className="train-progress"><span style={{ width: `${(idx / qs.length) * 100}%` }} /></div>
      <div className="question">
        <span className="eyebrow">{catName}</span>
        {q.kind === 'text' ? (
          <p className="question-text">{maskText(text, map.get(q.cc)?.mask ?? [])}</p>
        ) : (
          <img className="question-img" src={imageSrc((q.data as QuizPhoto).i)} alt="" />
        )}
        <div className="answers">
          {q.options.map((code, i) => (
            <button
              key={code}
              className={`answer ${picked && code === q.cc ? 'right' : ''} ${picked === code && code !== q.cc ? 'wrong' : ''}`}
              disabled={Boolean(picked)}
              onClick={() => answer(code)}
            >
              <kbd>{i + 1}</kbd><span className="flag">{countryFlag(map, code)}</span> {countryLabel(map, code)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExamSummary({ cc, ok, n, secs, onExit }: { cc: string; ok: number; n: number; secs: number; onExit: () => void }) {
  const map = useCountryMap()
  const s = useStudy()
  const history = (s.settings.data.exams ?? []).filter((e) => e.cc === cc)
  const prev = history.length > 1 ? history[history.length - 2] : null
  const best = useMemo(() => Math.max(...history.map((e) => e.ok / e.n)), [history])
  const pct = ok / n
  return (
    <div className="page-narrow">
      <header className="page-head">
        <span className="eyebrow">Examen · {countryFlag(map, cc)} {countryLabel(map, cc)}</span>
        <h1>{ok} de {n}</h1>
        <p className="lead">
          En {Math.floor(secs / 60)} min {secs % 60} s ({(secs / n).toFixed(1).replace('.', ',')} s por pregunta).
          {prev && ` La vez anterior: ${prev.ok} de ${prev.n}.`}
          {pct >= best && history.length > 1 && ' ¡Tu mejor nota!'}
        </p>
      </header>
      <ExamHistory cc={cc} />
      <div className="row">
        <Link to={`/pais/${cc}`} className="btn btn-lg">Repasar la guía</Link>
        <button className="btn btn-primary btn-lg" onClick={onExit}>Volver</button>
      </div>
    </div>
  )
}

/** Notas de los exámenes de un país, de la más antigua a la última. */
export function ExamHistory({ cc }: { cc: string }) {
  const s = useStudy()
  const list = (s.settings.data.exams ?? []).filter((e) => e.cc === cc).slice(-12)
  if (!list.length) return null
  return (
    <div className="exam-history" aria-label="Historial de exámenes">
      {list.map((e) => (
        <span key={e.at} className="exam-bar" title={`${new Date(e.at).toLocaleDateString('es')}: ${e.ok}/${e.n} en ${e.secs} s`}>
          <span style={{ height: `${(e.ok / e.n) * 100}%` }} />
          <small>{e.ok}</small>
        </span>
      ))}
    </div>
  )
}
