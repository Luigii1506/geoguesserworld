import { Link, useParams } from 'react-router-dom'
import { COMPARISON_MAP } from '../data/comparisons'
import { COUNTRY_MAP } from '../data/countries'
import { CLUE_MAP } from '../data/clues'

export default function ComparisonPage() {
  const { id } = useParams()
  const comp = id ? COMPARISON_MAP.get(id) : undefined

  if (!comp) {
    return (
      <div className="empty">
        Comparación no encontrada. <Link to="/atlas">Volver al Atlas</Link>
      </div>
    )
  }

  const related = (comp.relatedClues ?? []).map((r) => CLUE_MAP.get(r)).filter(Boolean)

  return (
    <div className="reveal">
      <nav className="breadcrumb">
        <Link to="/atlas">Atlas</Link> › {comp.title}
      </nav>

      <header className="page-head" style={{ marginBottom: '1.2rem' }}>
        <h1>{comp.title}</h1>
        <p className="lede">{comp.intro}</p>
      </header>

      <div className="card table-scroll" style={{ marginBottom: '1.4rem', padding: '0.4rem 0.8rem' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Pista</th>
              {comp.countries.map((code) => {
                const c = COUNTRY_MAP.get(code)
                return (
                  <th key={code}>
                    <Link to={`/pais/${code}`} style={{ textDecoration: 'none' }}>
                      <span style={{ fontSize: '1.2rem' }}>{c?.flag}</span> {c?.name}
                    </Link>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {comp.rows.map((row, i) => (
              <tr key={i} className={row.overlap ? 'row-overlap' : ''}>
                <td>
                  {row.category}
                  {row.overlap && <span className="overlap-mark">⚠ se solapa</span>}
                </td>
                {row.cells.map((cell, j) => (
                  <td key={j}>
                    {cell}
                    {j === row.cells.length - 1 && row.note && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: '0.25rem' }}>
                        {row.note}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="explain" style={{ marginBottom: '1.4rem' }}>
        <strong>Veredicto operativo.</strong> {comp.verdict}
      </div>

      {related.length > 0 && (
        <>
          <h2>Fichas implicadas</h2>
          <div className="chips">
            {related.map((r) => (
              <Link key={r!.id} to={`/pista/${r!.id}`} className="tag">
                {r!.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
