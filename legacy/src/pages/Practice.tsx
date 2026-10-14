import { useState } from 'react'
import type { Question } from '../data/types'
import { ALL_QUESTIONS as QUESTIONS } from '../data/bank'
import { CATEGORIES } from '../data/categories'
import { GENERATORS } from '../lib/quizgen'
import QuizRunner from '../components/QuizRunner'

interface Session {
  title: string
  questions: Question[]
  srs: boolean
}

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export default function Practice() {
  const [session, setSession] = useState<Session | null>(null)
  const [categoria, setCategoria] = useState('')

  const categoriesWithQuestions = CATEGORIES.filter((c) =>
    QUESTIONS.some((q) => q.category === c.id),
  )

  if (session) {
    return (
      <div className="reveal">
        <header className="page-head" style={{ marginBottom: '1rem' }}>
          <span className="kicker">Práctica</span>
          <h1>{session.title}</h1>
        </header>
        <QuizRunner
          questions={session.questions}
          mode="practica"
          srs={session.srs}
          onFinish={() => setSession(null)}
          finishLabel="Volver a práctica"
        />
        <button className="btn btn-ghost" onClick={() => setSession(null)} style={{ marginTop: '0.6rem' }}>
          ← Abandonar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Práctica</span>
        <h1>Elige tu entrenamiento</h1>
        <p className="lede">
          Las preguntas del banco alimentan tu calendario de repaso; las ráfagas generadas son
          calentamiento infinito que no ensucia el calendario.
        </p>
      </header>

      <h2>Banco de preguntas</h2>
      <div className="grid grid-2" style={{ marginBottom: '1.6rem' }}>
        <button
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          onClick={() =>
            setSession({ title: 'Examen mixto', questions: sample(QUESTIONS, 10), srs: true })
          }
        >
          <h3 className="card-title">🎲 Examen mixto</h3>
          <p className="card-desc">10 preguntas al azar de todas las categorías, con explicación tras cada respuesta.</p>
        </button>

        <div className="card">
          <h3 className="card-title">🗂 Por categoría</h3>
          <p className="card-desc" style={{ marginBottom: '0.6rem' }}>
            Concentra el entrenamiento en una sola familia de pistas.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select className="select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Elegir categoría…</option>
              {categoriesWithQuestions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} ({QUESTIONS.filter((q) => q.category === c.id).length})
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={!categoria}
              onClick={() => {
                const cat = categoriesWithQuestions.find((c) => c.id === categoria)!
                setSession({
                  title: `${cat.icon} ${cat.name}`,
                  questions: sample(QUESTIONS.filter((q) => q.category === categoria), 10),
                  srs: true,
                })
              }}
            >
              Empezar
            </button>
          </div>
        </div>
      </div>

      <h2>Ráfagas generadas</h2>
      <div className="grid grid-3" style={{ marginBottom: '1.6rem' }}>
        {GENERATORS.map((g) => (
          <button
            key={g.id}
            className="card"
            style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            onClick={() =>
              setSession({
                title: g.name,
                questions: Array.from({ length: 10 }, () => g.make()),
                srs: false,
              })
            }
          >
            <h3 className="card-title">⚡ {g.name}</h3>
            <p className="card-desc">{g.description}</p>
          </button>
        ))}
      </div>

      <h2>Práctica externa</h2>
      <p className="lede" style={{ marginBottom: '0.9rem' }}>
        Cuando domines el material de aquí, el siguiente nivel está fuera:
      </p>
      <div className="grid grid-3">
        <a className="card" href="https://www.jetpunk.com/quizzes/how-many-countries-can-you-name" target="_blank" rel="noreferrer">
          <h3 className="card-title">🌍 JetPunk</h3>
          <p className="card-desc">Países del mundo, capitales y banderas: la base memorística.</p>
        </a>
        <a className="card" href="https://geohints.com/games/bollards" target="_blank" rel="noreferrer">
          <h3 className="card-title">🦺 GeoHints · Bollards</h3>
          <p className="card-desc">Juego de bolardos con fotos reales de todos los países.</p>
        </a>
        <a className="card" href="https://learnablemeta.com/docs/getting-started" target="_blank" rel="noreferrer">
          <h3 className="card-title">🗺️ Learnable Meta</h3>
          <p className="card-desc">Mapas con explicación tras cada guess, dentro del propio GeoGuessr.</p>
        </a>
      </div>
    </div>
  )
}
