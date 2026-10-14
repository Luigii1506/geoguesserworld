import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CLUES } from '../data/clues'
import { CATEGORIES, DOMAINS } from '../data/categories'
import { COUNTRIES, CONTINENTS } from '../data/countries'
import ClueCard from '../components/ClueCard'

export default function Academy() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const categoria = params.get('categoria') ?? ''
  const continente = params.get('continente') ?? ''
  const pais = params.get('pais') ?? ''

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // cambiar de continente invalida el país elegido
    if (key === 'continente') next.delete('pais')
    setParams(next, { replace: true })
  }

  const visibleCountries = useMemo(
    () => COUNTRIES.filter((c) => !continente || c.continent === continente),
    [continente],
  )

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return CLUES.filter((clue) => {
      if (categoria && clue.category !== categoria) return false
      if (pais && !clue.countries.includes(pais)) return false
      if (continente && !pais) {
        const codes = new Set(visibleCountries.map((c) => c.code))
        if (clue.countries.length > 0 && !clue.countries.some((c) => codes.has(c))) return false
      }
      if (needle) {
        const hay = `${clue.name} ${clue.visual} ${clue.lookFor} ${clue.howToUse}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [q, categoria, continente, pais, visibleCountries])

  return (
    <div className="reveal">
      <header className="page-head">
        <span className="kicker">Academia</span>
        <h1>Biblioteca de pistas</h1>
        <p className="lede">
          {CLUES.length} fichas organizadas por continente, país y categoría. Cada una declara su
          nivel de evidencia, sus excepciones y con qué otras pistas se combina.
        </p>
      </header>

      <div className="pill-row" style={{ marginBottom: '0.8rem' }}>
        <button className={`pill ${!continente ? 'active' : ''}`} onClick={() => setParam('continente', '')}>
          Todo el mundo
        </button>
        {CONTINENTS.map((c) => (
          <button
            key={c.id}
            className={`pill ${continente === c.id ? 'active' : ''}`}
            onClick={() => setParam('continente', c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          className="search-input"
          placeholder="Buscar: bolardo, ř, amarilla, snorkel…"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select className="select" value={categoria} onChange={(e) => setParam('categoria', e.target.value)}>
          <option value="">Todas las categorías</option>
          {Object.entries(DOMAINS).map(([letter, domain]) => (
            <optgroup key={letter} label={`${letter} · ${domain}`}>
              {CATEGORIES.filter((c) => c.domain === letter).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select className="select" value={pais} onChange={(e) => setParam('pais', e.target.value)}>
          <option value="">Todos los países</option>
          {visibleCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>

      {results.length === 0 ? (
        <div className="empty">
          Ninguna ficha coincide con esos filtros. Prueba a ampliar la búsqueda — o es un hueco del
          temario que merece una ficha nueva.
        </div>
      ) : (
        <div className="grid grid-2">
          {results.map((clue) => (
            <ClueCard key={clue.id} clue={clue} />
          ))}
        </div>
      )}
    </div>
  )
}
