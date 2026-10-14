import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ALL_QUESTION_MAP as QUESTION_MAP } from '../data/bank'
import QuizRunner from '../components/QuizRunner'
import { useProgress } from '../lib/storage'
import { dueQuestionIds, newQuestionIds } from '../lib/mastery'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type SessionKind = 'vencidas' | 'nuevas' | null

export default function Review() {
  const progress = useProgress()
  const [kind, setKind] = useState<SessionKind>(null)
  // La sesión se congela al empezar: responder no debe recalcular la lista.
  const [sessionIds, setSessionIds] = useState<string[]>([])

  const due = dueQuestionIds(progress)
  const fresh = newQuestionIds(progress)

  const upcoming = useMemo(() => {
    const days: Record<string, number> = {}
    for (const s of Object.values(progress.srs)) {
      days[s.due] = (days[s.due] ?? 0) + 1
    }
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 7)
  }, [progress.srs])

  function start(which: Exclude<SessionKind, null>) {
    const ids = which === 'vencidas' ? shuffle(due) : shuffle(fresh).slice(0, 10)
    setSessionIds(ids)
    setKind(which)
  }

  if (kind) {
    const questions = sessionIds
      .map((id) => QUESTION_MAP.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
    return (
      <div className="reveal">
        <header className="page-head" style={{ marginBottom: '1rem' }}>
          <span className="kicker">Repetición espaciada · SM-2</span>
          <h1>{kind === 'vencidas' ? 'Repaso de vencidas' : 'Material nuevo'}</h1>
        </header>
        <QuizRunner
          questions={questions}
          mode="repaso"
          srs
          onFinish={() => setKind(null)}
          finishLabel="Terminar sesión"
        />
        <button className="btn btn-ghost" onClick={() => setKind(null)} style={{ marginTop: '0.6rem' }}>
          ← Salir
        </button>
      </div>
    )
  }

  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Repetición espaciada · SM-2</span>
        <h1>Repaso</h1>
        <p className="lede">
          Cada pregunta tiene su propio calendario: acertarla la aleja, fallarla la trae de vuelta.
          El algoritmo es SM-2, documentado en <code>src/lib/sm2.ts</code>. Después de acertar,
          elige la dificultad con honestidad: reconocer la respuesta no es lo mismo que saberla.
        </p>
      </header>

      <div className="grid grid-2" style={{ marginBottom: '1.6rem' }}>
        <div className="card" style={due.length > 0 ? { borderColor: 'var(--accent)' } : undefined}>
          <h3 className="card-title">🔁 Vencidas hoy</h3>
          <p className="card-desc" style={{ marginBottom: '0.7rem' }}>
            {due.length === 0
              ? 'Nada pendiente. El calendario está al día.'
              : `${due.length} preguntas esperan repaso: son las que estás a punto de olvidar.`}
          </p>
          <button className="btn btn-primary" disabled={due.length === 0} onClick={() => start('vencidas')}>
            Repasar {due.length > 0 ? `(${due.length})` : ''}
          </button>
        </div>

        <div className="card">
          <h3 className="card-title">✨ Material nuevo</h3>
          <p className="card-desc" style={{ marginBottom: '0.7rem' }}>
            {fresh.length === 0
              ? 'Todo el banco está ya en tu calendario.'
              : `${fresh.length} preguntas aún no entraron en tu calendario. Introduce hasta 10.`}
          </p>
          <button className="btn" disabled={fresh.length === 0} onClick={() => start('nuevas')}>
            Aprender nuevas
          </button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <>
          <h2>Próximos repasos</h2>
          <div className="card">
            {upcoming.map(([date, count]) => (
              <div key={date} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--line-soft)' }}>
                <span className="mono" style={{ fontSize: '0.8rem' }}>{date}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{count} preguntas</span>
              </div>
            ))}
          </div>
        </>
      )}

      <hr className="divider" />
      <p style={{ fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
        ¿Quieres más material? Estudia fichas en la <Link to="/academia">Academia</Link> y haz los
        drills del <Link to="/laboratorio">Laboratorio</Link>: sus preguntas también entran en este
        calendario.
      </p>
    </div>
  )
}
