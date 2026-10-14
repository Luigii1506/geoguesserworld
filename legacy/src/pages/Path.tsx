import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PATH } from '../data/path'
import { ALL_QUESTION_MAP } from '../data/bank'
import { CLUE_MAP } from '../data/clues'
import QuizRunner from '../components/QuizRunner'
import { useProgress } from '../lib/storage'
import { Meter } from '../components/Badges'

export function unitProgress(srs: Record<string, unknown>, drillIds: string[]): number {
  if (drillIds.length === 0) return 1
  const done = drillIds.filter((id) => srs[id]).length
  return done / drillIds.length
}

export default function Path() {
  const progress = useProgress()
  const [activeUnit, setActiveUnit] = useState<string | null>(null)

  const unit = activeUnit ? PATH.find((u) => u.id === activeUnit) : null
  if (unit) {
    const questions = unit.drillQuestionIds
      .map((id) => ALL_QUESTION_MAP.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
    return (
      <div className="reveal">
        <header className="page-head" style={{ marginBottom: '1rem' }}>
          <span className="kicker">Ruta · drill de unidad</span>
          <h1>
            {unit.icon} {unit.title}
          </h1>
        </header>
        <QuizRunner
          questions={questions}
          mode="practica"
          srs
          onFinish={() => setActiveUnit(null)}
          finishLabel="Volver a la Ruta"
        />
        <button className="btn btn-ghost" onClick={() => setActiveUnit(null)} style={{ marginTop: '0.6rem' }}>
          ← Volver a la Ruta
        </button>
      </div>
    )
  }

  const firstIncomplete = PATH.findIndex((u) => unitProgress(progress.srs, u.drillQuestionIds) < 1)

  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Tu plan</span>
        <h1>La Ruta: de plonk al 5000</h1>
        <p className="lede">
          Diez unidades en orden. En cada una: estudia sus fichas, haz el drill, y deja que el
          repaso espaciado haga el resto. Una unidad queda completada cuando todas sus preguntas
          entran en tu calendario.
        </p>
      </header>

      <div>
        {PATH.map((u, i) => {
          const pct = unitProgress(progress.srs, u.drillQuestionIds)
          const done = pct >= 1
          const current = i === firstIncomplete
          const clues = u.clueIds.map((id) => CLUE_MAP.get(id)).filter(Boolean)
          return (
            <div key={u.id} className="unit-row">
              <span className={`unit-dot ${done ? 'done' : current ? 'current' : ''}`}>
                {done ? '✓' : i + 1}
              </span>
              <div className="card" style={{ flex: 1, ...(current ? { borderColor: 'var(--accent)' } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'baseline' }}>
                  <h3 className="card-title">
                    {u.icon} {u.title}
                  </h3>
                  <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-faint)' }}>
                    {Math.round(pct * 100)}%
                  </span>
                </div>
                <p className="card-desc" style={{ marginBottom: '0.6rem' }}>{u.goal}</p>
                <Meter value={pct} />
                {(current || done) && clues.length > 0 && (
                  <div className="chips" style={{ margin: '0.7rem 0 0' }}>
                    {clues.map((c) => (
                      <Link key={c!.id} to={`/pista/${c!.id}`} className="tag">
                        {c!.name}
                      </Link>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={current ? 'btn btn-primary' : 'btn'}
                    onClick={() => setActiveUnit(u.id)}
                  >
                    {done ? 'Repetir drill' : current ? 'Continuar aquí →' : 'Hacer drill'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
