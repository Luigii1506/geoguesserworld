import { Link, useParams } from 'react-router-dom'
import { CLUE_MAP } from '../data/clues'
import { CATEGORY_MAP } from '../data/categories'
import { COMPARISONS } from '../data/comparisons'
import { questionsForClue } from '../data/questions'
import { ConfidenceBadge, CountryChips, MASTERY_LABELS } from '../components/Badges'
import QuizRunner from '../components/QuizRunner'
import { useProgress, updateProgress, type MasteryLevel } from '../lib/storage'

export default function ClueDetail() {
  const { id } = useParams()
  const progress = useProgress()
  const clue = id ? CLUE_MAP.get(id) : undefined

  if (!clue) {
    return (
      <div className="empty">
        Esa ficha no existe. <Link to="/academia">Volver a la Academia</Link>
      </div>
    )
  }

  const cat = CATEGORY_MAP.get(clue.category)
  const mastery = progress.clueMastery[clue.id] ?? 0
  const related = (clue.related ?? []).map((r) => CLUE_MAP.get(r)).filter(Boolean)
  const comparisons = COMPARISONS.filter((c) => c.relatedClues?.includes(clue.id))
  const questions = questionsForClue(clue.id)

  return (
    <div className="reveal">
      <nav className="breadcrumb">
        <Link to="/academia">Academia</Link> ›{' '}
        <Link to={`/academia?categoria=${clue.category}`}>
          {cat?.icon} {cat?.name}
        </Link>
      </nav>

      <header className="page-head" style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <ConfidenceBadge level={clue.confidence} />
          <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-faint)' }}>
            verificada {clue.verifiedAt}
          </span>
        </div>
        <h1>{clue.name}</h1>
        {clue.countries.length > 0 && <CountryChips codes={clue.countries} max={10} />}
      </header>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="clue-section">
              <h3>Qué estás viendo</h3>
              <p>{clue.visual}</p>
            </div>
            <div className="clue-section">
              <h3>Qué observar exactamente</h3>
              <p>{clue.lookFor}</p>
            </div>
            {clue.why && (
              <div className="clue-section">
                <h3>Por qué existe</h3>
                <p>{clue.why}</p>
              </div>
            )}
            <div className="clue-section">
              <h3>Cómo usarla en partida</h3>
              <p>{clue.howToUse}</p>
            </div>

            {clue.confusions && clue.confusions.length > 0 && (
              <div className="clue-section">
                <h3>Se confunde con</h3>
                {clue.confusions.map((conf, i) => (
                  <div key={i} style={{ marginBottom: '0.5rem' }}>
                    <CountryChips codes={conf.countries} />
                    <p style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>{conf.distinction}</p>
                  </div>
                ))}
              </div>
            )}

            {clue.exceptions && clue.exceptions.length > 0 && (
              <div className="clue-section">
                <h3>Excepciones conocidas</h3>
                <ul className="exception-list">
                  {clue.exceptions.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="source-note">
              Fuentes:{' '}
              {clue.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ' · '}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                </span>
              ))}
              . Contenido redactado para GeoMastery; las fuentes se enlazan como referencia visual.
            </div>
          </div>

          {questions.length > 0 && (
            <>
              <h2>Ponte a prueba</h2>
              <QuizRunner questions={questions} mode="practica" srs />
            </>
          )}
        </div>

        <aside>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.6rem' }}>Tu dominio</h3>
            <div className="mastery-btns">
              {MASTERY_LABELS.map((label, i) => (
                <button
                  key={label}
                  className={`pill ${mastery === i ? 'active' : ''}`}
                  onClick={() =>
                    updateProgress((p) => ({
                      ...p,
                      clueMastery: { ...p.clueMastery, [clue.id]: i as MasteryLevel },
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {related.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '0.6rem' }}>Pistas relacionadas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {related.map((r) => (
                  <Link key={r!.id} to={`/pista/${r!.id}`} style={{ fontSize: '0.9rem' }}>
                    → {r!.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {comparisons.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.6rem' }}>En el Atlas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {comparisons.map((c) => (
                  <Link key={c.id} to={`/atlas/${c.id}`} style={{ fontSize: '0.9rem' }}>
                    ⚖️ {c.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
