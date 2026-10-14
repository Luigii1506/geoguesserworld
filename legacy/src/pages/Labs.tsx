import { Link } from 'react-router-dom'
import { LABS } from '../data/labs'

export default function Labs() {
  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Laboratorio</span>
        <h1>Estudio de una pista a la vez</h1>
        <p className="lede">
          Cada laboratorio aísla una familia de pistas: estudias los diseños país a país y terminas
          con un drill de reconocimiento que alimenta tu calendario de repaso.
        </p>
      </header>

      <div className="grid grid-2">
        {LABS.map((lab) => (
          <Link key={lab.id} to={`/laboratorio/${lab.id}`} className="card">
            <h3 className="card-title">
              <span>{lab.icon}</span> {lab.title}
            </h3>
            <p className="card-desc">{lab.intro.length > 150 ? lab.intro.slice(0, 150) + '…' : lab.intro}</p>
            <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {lab.items.length} ejemplos · {lab.drillQuestionIds.length} preguntas de drill
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
