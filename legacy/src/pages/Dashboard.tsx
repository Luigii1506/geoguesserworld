import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useProgress, exportProgress, importProgress, resetProgress } from '../lib/storage'
import { categoryStats, globalStats, weakClues } from '../lib/mastery'
import { CATEGORY_MAP } from '../data/categories'
import { PATH } from '../data/path'
import { unitProgress } from './Path'
import { Meter } from '../components/Badges'
import ClueCard from '../components/ClueCard'

export default function Dashboard() {
  const progress = useProgress()
  const stats = globalStats(progress)
  const cats = categoryStats(progress)
  const weak = weakClues(progress, 3)
  const fileRef = useRef<HTMLInputElement>(null)

  function download() {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `geomastery-progreso-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    if (!importProgress(text)) alert('El archivo no tiene el formato de progreso esperado.')
    e.target.value = ''
  }

  const nextUnit = PATH.find((u) => unitProgress(progress.srs, u.drillQuestionIds) < 1)
  const pathDone = PATH.filter((u) => unitProgress(progress.srs, u.drillQuestionIds) >= 1).length

  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Cuaderno de expedición</span>
        <h1>Deja de adivinar. Empieza a reconocer.</h1>
        <p className="lede">
          Cada ronda perdida es una pista que aún no has estudiado. El plan es simple: sigue la
          Ruta, haz los drills y repasa cuando toca — el calendario se encarga de que no se te
          olvide. Tu progreso vive en este navegador: expórtalo de vez en cuando.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
          {stats.due > 0 ? (
            <Link to="/repaso" className="btn btn-primary">
              🔁 Repasar lo que toca hoy ({stats.due})
            </Link>
          ) : nextUnit ? (
            <Link to="/ruta" className="btn btn-primary">
              {nextUnit.icon} Continuar la Ruta: {nextUnit.title}
            </Link>
          ) : (
            <Link to="/practica" className="btn btn-primary">
              🎯 Examen mixto
            </Link>
          )}
          <Link to="/ruta" className="btn">
            🛤️ Ruta {pathDone}/{PATH.length}
          </Link>
        </div>
      </header>

      <div className="stat-row" style={{ marginBottom: '1.6rem' }}>
        <div className="stat">
          <div className="stat-num">{stats.due}</div>
          <div className="stat-label">Repasos pendientes</div>
        </div>
        <div className="stat">
          <div className="stat-num">
            {stats.masteredClues}
            <span style={{ fontSize: '0.9rem', color: 'var(--ink-faint)' }}> / {stats.totalClues}</span>
          </div>
          <div className="stat-label">Fichas dominadas</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats.totalAnswered}</div>
          <div className="stat-label">Respuestas totales</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%`}</div>
          <div className="stat-label">Precisión global</div>
        </div>
        <div className="stat">
          <div className="stat-num">
            {stats.inSrs}
            <span style={{ fontSize: '0.9rem', color: 'var(--ink-faint)' }}> / {stats.totalQuestions}</span>
          </div>
          <div className="stat-label">Preguntas en repaso</div>
        </div>
      </div>

      <h2>Dominio por categoría</h2>
      <div className="grid grid-2" style={{ marginBottom: '1.8rem' }}>
        {cats
          .filter((c) => c.total > 0)
          .map((c) => {
            const cat = CATEGORY_MAP.get(c.categoryId)!
            return (
              <Link key={c.categoryId} to={`/academia?categoria=${c.categoryId}`} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>
                    {cat.icon} {cat.name}
                  </strong>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                    {c.accuracy === null ? 'sin datos' : `${Math.round(c.accuracy * 100)}% acierto`}
                  </span>
                </div>
                <Meter value={c.strength} />
              </Link>
            )
          })}
      </div>

      {weak.length > 0 && (
        <>
          <h2>Siguiente objetivo</h2>
          <p className="lede" style={{ marginBottom: '0.9rem' }}>
            Fichas muy conectadas que aún no dominas: estudiarlas desbloquea más comparaciones.
          </p>
          <div className="grid grid-2" style={{ marginBottom: '1.8rem' }}>
            {weak.map((c) => (
              <ClueCard key={c.id} clue={c} />
            ))}
          </div>
        </>
      )}

      <hr className="divider" />
      <h2>Copia de seguridad</h2>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button className="btn" onClick={download}>
          ⬇ Exportar progreso
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬆ Importar progreso
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (confirm('¿Borrar todo el progreso? Esta acción no se puede deshacer.')) resetProgress()
          }}
        >
          Reiniciar todo
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
      </div>
    </div>
  )
}
