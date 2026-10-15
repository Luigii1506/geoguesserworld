import { Link } from 'react-router-dom'
import { useMeta } from '../lib/data'
import { useStudy } from '../lib/study/store'
import { dueCount } from '../lib/study/cards'

// Marco StoryBrand (Donald Miller): el jugador es el héroe, GeoMastery el guía,
// un plan de tres pasos y una sola acción principal.

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('es')

export default function Home() {
  const meta = useMeta()
  const study = useStudy()
  const t = meta?.totals
  const keys = Object.keys(study.cards)
  const due = dueCount(study)

  const primary =
    keys.length === 0
      ? { to: '/entrenar', label: 'Empieza a entrenar' }
      : { to: '/entrenar', label: due > 0 ? `Repasar ${due} pendientes` : 'Seguir entrenando' }

  return (
    <div>
      <section className="hero">
        <span className="eyebrow">GeoGuessr, con método</span>
        <h1>Reconoce el país en segundos, no en minutos.</h1>
        <p className="lead">
          Las pistas de las seis grandes guías de la comunidad, sin duplicados, traducidas y ordenadas por lo que de verdad
          te ubica. Estudia lo esencial, compara lo que se confunde y entrena hasta reconocerlo solo.
        </p>
        <div className="hero-actions">
          <Link to={primary.to} className="btn btn-primary btn-lg">{primary.label}</Link>
          <Link to="/paises" className="btn btn-lg">Explorar países</Link>
        </div>
      </section>

      <div className="stat-line">
        <div><strong>{fmt(t?.groups)}</strong><span>pistas únicas</span></div>
        <div><strong>{fmt(t?.essential)}</strong><span>determinantes</span></div>
        <div><strong>{fmt(t?.images)}</strong><span>imágenes</span></div>
        <div><strong>{fmt(t?.countries)}</strong><span>países</span></div>
      </div>

      <section className="home-section">
        <span className="eyebrow">Por qué cuesta</span>
        <div className="three">
          <div>
            <h3>Los países gemelos</h3>
            <p>Hungría o Rumanía, Suecia o Finlandia, Uruguay o Argentina. Los puntos se pierden en la última decisión.</p>
          </div>
          <div>
            <h3>Demasiada información suelta</h3>
            <p>Miles de consejos repartidos en guías y hojas de cálculo, repetidos y sin decir cuáles importan.</p>
          </div>
          <div>
            <h3>Memorizar al azar no funciona</h3>
            <p>Reconocer un país es una habilidad. Se aprende con orden y se fija repasando a tiempo.</p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <span className="eyebrow">El plan</span>
        <div className="three steps">
          <div>
            <h3>Estudia lo esencial</h3>
            <p>Cada país empieza por sus pistas determinantes: las que por sí solas te dicen dónde estás.</p>
            <Link to="/paises">Ir a países</Link>
          </div>
          <div>
            <h3>Distingue a los gemelos</h3>
            <p>Duelos en fotos entre los países que se confunden, con la clave en una frase y un quiz de dos minutos.</p>
            <Link to="/duelo">Duelos</Link>
          </div>
          <div>
            <h3>Entrena hasta reconocerlo</h3>
            <p>Preguntas con países que se confunden de verdad. Lo que fallas vuelve pronto; lo que dominas, más tarde.</p>
            <Link to="/entrenar">Entrenar</Link>
          </div>
        </div>
      </section>

      <section className="closing">
        <h2>Ves un bolardo y sabes qué países quedan.</h2>
        <p className="lead">Ese es el objetivo. Empieza por diez preguntas.</p>
        <Link to="/entrenar" className="btn btn-primary btn-lg">Empieza a entrenar</Link>
      </section>
    </div>
  )
}
