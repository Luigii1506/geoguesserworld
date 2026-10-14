import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LAB_MAP } from '../data/labs'
import { QUESTION_MAP } from '../data/questions'
import { CLUE_MAP } from '../data/clues'
import { countryFlag } from '../data/countries'
import QuizRunner from '../components/QuizRunner'

export default function LabPage() {
  const { id } = useParams()
  const lab = id ? LAB_MAP.get(id) : undefined
  const [drill, setDrill] = useState(false)

  if (!lab) {
    return (
      <div className="empty">
        Laboratorio no encontrado. <Link to="/laboratorio">Volver</Link>
      </div>
    )
  }

  const drillQuestions = lab.drillQuestionIds
    .map((qid) => QUESTION_MAP.get(qid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
  const related = (lab.relatedClues ?? []).map((r) => CLUE_MAP.get(r)).filter(Boolean)

  return (
    <div className="reveal">
      <nav className="breadcrumb">
        <Link to="/laboratorio">Laboratorio</Link> › {lab.title}
      </nav>

      <header className="page-head" style={{ marginBottom: '1.2rem' }}>
        <h1>
          {lab.icon} {lab.title}
        </h1>
        <p className="lede">{lab.intro}</p>
      </header>

      {!drill ? (
        <>
          <div className="grid grid-2" style={{ marginBottom: '1.4rem' }}>
            {lab.items.map((item, i) => (
              <div key={i} className="card">
                <h3 className="card-title">
                  {item.country && <span className="flag">{countryFlag(item.country)}</span>} {item.label}
                </h3>
                <p style={{ fontSize: '0.92rem', margin: '0 0 0.5rem' }}>{item.description}</p>
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', margin: 0 }}>
                  <strong>Clave:</strong> {item.distinguishing}
                </p>
              </div>
            ))}
          </div>

          {related.length > 0 && (
            <>
              <h2>Fichas de este laboratorio</h2>
              <div className="chips" style={{ marginBottom: '1.4rem' }}>
                {related.map((r) => (
                  <Link key={r!.id} to={`/pista/${r!.id}`} className="tag">
                    {r!.name}
                  </Link>
                ))}
              </div>
            </>
          )}

          {drillQuestions.length > 0 && (
            <button className="btn btn-primary" onClick={() => setDrill(true)}>
              Empezar el drill ({drillQuestions.length} preguntas) →
            </button>
          )}
        </>
      ) : (
        <>
          <QuizRunner
            questions={drillQuestions}
            mode="lab"
            srs
            onFinish={() => setDrill(false)}
            finishLabel="Volver al estudio"
          />
          <button className="btn btn-ghost" onClick={() => setDrill(false)} style={{ marginTop: '0.6rem' }}>
            ← Salir del drill
          </button>
        </>
      )}
    </div>
  )
}
