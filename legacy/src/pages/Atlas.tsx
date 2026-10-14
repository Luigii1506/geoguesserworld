import { Link } from 'react-router-dom'
import { COMPARISONS } from '../data/comparisons'
import { countryFlag } from '../data/countries'

export default function Atlas() {
  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Atlas comparativo</span>
        <h1>Países cara a cara</h1>
        <p className="lede">
          Los pares y tríos que más puntos cuestan, comparados pista a pista. Cuando una fila se
          solapa de verdad, lo decimos: forzar una diferencia inexistente es peor que no saber.
        </p>
      </header>

      <div className="grid grid-2">
        {COMPARISONS.map((c) => (
          <Link key={c.id} to={`/atlas/${c.id}`} className="card">
            <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>
              {c.countries.map((code) => countryFlag(code)).join(' vs ')}
            </div>
            <h3 className="card-title">{c.title}</h3>
            <p className="card-desc">{c.intro.length > 130 ? c.intro.slice(0, 130) + '…' : c.intro}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
