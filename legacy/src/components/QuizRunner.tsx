import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Question } from '../data/types'
import { CLUE_MAP } from '../data/clues'
import { updateProgress } from '../lib/storage'
import { newSm2State, review } from '../lib/sm2'
import WikiImage from './WikiImage'

interface Props {
  questions: Question[]
  mode: 'practica' | 'repaso' | 'lab'
  /** true: las respuestas alimentan el calendario SM-2 (solo preguntas estables). */
  srs?: boolean
  onFinish?: () => void
  finishLabel?: string
}

interface Shuffled {
  options: string[]
  correctIndex: number
}

function shuffleOptions(q: Question): Shuffled {
  const indexed = q.options.map((text, i) => ({ text, i }))
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indexed[i], indexed[j]] = [indexed[j], indexed[i]]
  }
  return {
    options: indexed.map((o) => o.text),
    correctIndex: indexed.findIndex((o) => o.i === q.answer),
  }
}

export default function QuizRunner({ questions, mode, srs = false, onFinish, finishLabel }: Props) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [results, setResults] = useState<boolean[]>([])
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  const q = questions[idx]
  const shuffled = useMemo(() => (q ? shuffleOptions(q) : null), [q])

  if (!q || !shuffled) return <div className="empty">No hay preguntas disponibles.</div>

  const answered = picked !== null
  const correct = answered && picked === shuffled.correctIndex
  const done = idx >= questions.length - 1 && answered

  function pick(i: number) {
    if (answered) return
    const ms = Date.now() - startRef.current
    setElapsed(ms)
    setPicked(i)
    const ok = i === shuffled!.correctIndex
    setResults((r) => [...r, ok])
    updateProgress((p) => ({
      ...p,
      log: [...p.log.slice(-999), { date: new Date().toISOString(), questionId: q.id, correct: ok, ms, mode }],
    }))
    if (srs && !ok) applyGrade(1, ms)
  }

  function applyGrade(grade: number, ms: number) {
    updateProgress((p) => {
      const prev = p.srs[q.id] ?? newSm2State()
      return { ...p, srs: { ...p.srs, [q.id]: review(prev, grade, ms) } }
    })
  }

  function next() {
    if (done) {
      onFinish?.()
      return
    }
    setIdx((i) => i + 1)
    setPicked(null)
    startRef.current = Date.now()
  }

  function gradeAndNext(grade: number) {
    applyGrade(grade, elapsed)
    next()
  }

  const relatedClues = (q.relatedClues ?? []).map((id) => CLUE_MAP.get(id)).filter(Boolean)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
        <span className="quiz-progress">
          PREGUNTA {idx + 1} / {questions.length}
        </span>
        <span className="quiz-progress">
          {results.filter(Boolean).length} ✓ · {results.filter((r) => !r).length} ✗
        </span>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem' }}>{q.prompt}</h2>
        {q.image && <WikiImage title={q.image} eager showAttribution={answered} />}
        {q.hint && !answered && (
          <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', marginTop: q.image ? 0 : '-0.4rem' }}>
            💡 {q.hint}
          </p>
        )}
        <div>
          {shuffled.options.map((opt, i) => (
            <button
              key={i}
              className={
                'quiz-option' +
                (answered && i === shuffled.correctIndex ? ' correct' : '') +
                (answered && i === picked && i !== shuffled.correctIndex ? ' wrong' : '')
              }
              disabled={answered}
              onClick={() => pick(i)}
            >
              {opt}
            </button>
          ))}
        </div>

        {answered && (
          <>
            <div className="explain">
              <strong>{correct ? '✓ Correcto.' : '✗ No era esa.'}</strong> {q.explanation}
            </div>
            {relatedClues.length > 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                Repasa:{' '}
                {relatedClues.map((c, i) => (
                  <span key={c!.id}>
                    {i > 0 && ' · '}
                    <Link to={`/pista/${c!.id}`}>{c!.name}</Link>
                  </span>
                ))}
              </p>
            )}
            {srs && correct ? (
              <div className="mastery-btns">
                <button className="btn" onClick={() => gradeAndNext(3)}>
                  Difícil
                </button>
                <button className="btn" onClick={() => gradeAndNext(4)}>
                  Bien
                </button>
                <button className="btn btn-primary" onClick={() => gradeAndNext(5)}>
                  Fácil
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={next}>
                {done ? finishLabel ?? 'Terminar' : 'Siguiente →'}
              </button>
            )}
          </>
        )}
      </div>

      {done && answered && (
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
          Sesión completada: {results.filter(Boolean).length} de {results.length} correctas.
        </p>
      )}
    </div>
  )
}
