import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LANDMARKS, LANDMARK_QUESTIONS } from '../data/landmarks'
import { COUNTRY_MAP, CONTINENTS, countryFlag, countryName } from '../data/countries'
import WikiImage from '../components/WikiImage'
import QuizRunner from '../components/QuizRunner'

const TYPES = [
  { id: '', name: 'Todo' },
  { id: 'monumento', name: '🏛 Monumentos' },
  { id: 'ciudad', name: '🏙 Ciudades' },
  { id: 'natural', name: '🏔 Naturales' },
] as const

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export default function World() {
  const [tipo, setTipo] = useState('')
  const [continente, setContinente] = useState('')
  const [quiz, setQuiz] = useState(false)

  const results = useMemo(
    () =>
      LANDMARKS.filter((l) => {
        if (tipo && l.type !== tipo) return false
        if (continente && COUNTRY_MAP.get(l.country)?.continent !== continente) return false
        return true
      }),
    [tipo, continente],
  )

  if (quiz) {
    return (
      <div className="reveal">
        <header className="page-head" style={{ marginBottom: '1rem' }}>
          <span className="kicker">Mundo</span>
          <h1>¿Dónde está esto?</h1>
        </header>
        <QuizRunner
          questions={sample(LANDMARK_QUESTIONS, 10)}
          mode="practica"
          srs
          onFinish={() => setQuiz(false)}
          finishLabel="Volver a la galería"
        />
        <button className="btn btn-ghost" onClick={() => setQuiz(false)} style={{ marginTop: '0.6rem' }}>
          ← Salir del quiz
        </button>
      </div>
    )
  }

  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Mundo</span>
        <h1>Ciudades, monumentos y parajes</h1>
        <p className="lede">
          {LANDMARKS.length} lugares que valen un 5000 cuando los reconoces al instante. Imágenes y
          resúmenes en vivo desde Wikipedia (CC BY-SA, con atribución). Estudia la galería y luego
          ponte a prueba: esas preguntas entran en tu calendario de repaso.
        </p>
        <button className="btn btn-primary" onClick={() => setQuiz(true)}>
          🎯 Quiz: ¿dónde está esto? (10 preguntas)
        </button>
      </header>

      <div className="pill-row" style={{ marginBottom: '0.7rem' }}>
        {TYPES.map((t) => (
          <button key={t.id} className={`pill ${tipo === t.id ? 'active' : ''}`} onClick={() => setTipo(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="pill-row" style={{ marginBottom: '1.3rem' }}>
        <button className={`pill ${!continente ? 'active' : ''}`} onClick={() => setContinente('')}>
          Todo el mundo
        </button>
        {CONTINENTS.map((c) => (
          <button
            key={c.id}
            className={`pill ${continente === c.id ? 'active' : ''}`}
            onClick={() => setContinente(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-3">
        {results.map((l) => (
          <div key={l.id} className="card landmark-card">
            <WikiImage title={l.wikiTitle} showAttribution={false} className="" />
            <h3 className="card-title" style={{ fontSize: '0.98rem' }}>{l.name}</h3>
            <Link to={`/pais/${l.country}`} className="tag" style={{ marginBottom: '0.4rem' }}>
              <span className="flag">{countryFlag(l.country)}</span> {countryName(l.country)}
            </Link>
            <p className="card-desc">{l.clue}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
