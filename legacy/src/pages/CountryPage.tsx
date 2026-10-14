import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { COUNTRY_MAP, CONTINENTS } from '../data/countries'
import { CATEGORY_MAP } from '../data/categories'
import { cluesByCountry } from '../data/clues'
import { COMPARISONS } from '../data/comparisons'
import { plonkitUrl } from '../data/plonkit'
import { countryStreetView } from '../data/capitals'
import ClueCard from '../components/ClueCard'
import Markdown from '../components/Markdown'
import { usePlonkitGuide, useGeometas, plonkitImageUrl } from '../lib/community'

export default function CountryPage() {
  const { code } = useParams()
  const country = code ? COUNTRY_MAP.get(code) : undefined
  const guide = usePlonkitGuide(code ?? '')
  const geometas = useGeometas(code ?? '')
  const [openSection, setOpenSection] = useState(0)
  const [tab, setTab] = useState<'fichas' | 'guia' | 'metas'>('fichas')

  if (!country) {
    return (
      <div className="empty">
        País no encontrado. <Link to="/academia">Volver a la Academia</Link>
      </div>
    )
  }

  const clues = cluesByCountry(country.code)
  const comparisons = COMPARISONS.filter((c) => c.countries.includes(country.code))
  const continentName = CONTINENTS.find((c) => c.id === country.continent)?.name
  const sv = countryStreetView(country.code)
  const guideTips = guide?.sections.reduce((a, s) => a + s.tips.length, 0) ?? 0

  return (
    <div className="reveal">
      <nav className="breadcrumb">
        <Link to="/academia">Academia</Link> ›{' '}
        <Link to={`/academia?continente=${country.continent}`}>{continentName}</Link>
      </nav>

      <header className="page-head" style={{ marginBottom: '1.2rem' }}>
        <h1>
          <span style={{ marginRight: '0.4rem' }}>{country.flag}</span>
          {country.name}
        </h1>
        <div className="chips">
          <span className="tag">↔️ Conduce por la {country.driving}</span>
          <span className="tag mono">{country.tld}</span>
          <span className="tag">🗣 {country.languages.join(', ')}</span>
          <span className="tag">🔤 {country.scripts.join(' · ')}</span>
          {sv && (
            <a className="tag" href={sv.url} target="_blank" rel="noreferrer">
              📍 Street View en {sv.name} ↗
            </a>
          )}
        </div>
      </header>

      <h2>Datos rápidos</h2>
      <div className="card" style={{ marginBottom: '1.4rem' }}>
        {country.quickFacts.map((f, i) => {
          const cat = CATEGORY_MAP.get(f.category)
          return (
            <div key={i} className="clue-section" style={{ marginBottom: '0.8rem' }}>
              <h3>{cat ? `${cat.icon} ${cat.name}` : f.category}</h3>
              <p>{f.fact}</p>
            </div>
          )
        })}
        {country.coverage && (
          <div className="clue-section" style={{ marginBottom: 0 }}>
            <h3>🗺️ Cobertura (meta)</h3>
            <p>{country.coverage}</p>
          </div>
        )}
      </div>

      <div className="pill-row" style={{ marginBottom: '1.2rem' }}>
        <button className={`pill ${tab === 'fichas' ? 'active' : ''}`} onClick={() => setTab('fichas')}>
          📚 Fichas propias ({clues.length})
        </button>
        <button className={`pill ${tab === 'guia' ? 'active' : ''}`} onClick={() => setTab('guia')}>
          🧷 Guía Plonk It {guide ? `(${guideTips})` : ''}
        </button>
        <button className={`pill ${tab === 'metas' ? 'active' : ''}`} onClick={() => setTab('metas')}>
          🧩 Metas Geometas {geometas ? `(${geometas.metas.length})` : ''}
        </button>
      </div>

      {tab === 'fichas' && (
        <>
          {clues.length === 0 ? (
            <div className="empty">Aún no hay fichas propias: hueco del temario detectado.</div>
          ) : (
            <div className="grid grid-2" style={{ marginBottom: '1.4rem' }}>
              {clues.map((c) => (
                <ClueCard key={c.id} clue={c} />
              ))}
            </div>
          )}
          {comparisons.length > 0 && (
            <>
              <h2>Comparaciones en el Atlas</h2>
              <div className="chips">
                {comparisons.map((c) => (
                  <Link key={c.id} to={`/atlas/${c.id}`} className="tag">
                    ⚖️ {c.title}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'guia' &&
        (guide === undefined ? (
          <div className="empty">Cargando…</div>
        ) : guide === null ? (
          <div className="empty">
            Guía no importada todavía. Ejecuta <code>npm run importar</code> (o{' '}
            <code>npm run importar:plonkit {country.code}</code>) y recarga.
            <br />
            <a href={plonkitUrl(country.code)} target="_blank" rel="noreferrer">
              Ver la guía original en plonkit.net ↗
            </a>
          </div>
        ) : (
          <>
            <p className="import-note">
              Importada de{' '}
              <a href={guide.sourceUrl} target="_blank" rel="noreferrer">
                {guide.source}
              </a>{' '}
              el {guide.importedAt} · solo uso personal, no redistribuir · imágenes servidas desde
              el sitio original.
            </p>
            {guide.sections.map((section, si) => (
              <div key={si} className="card" style={{ marginBottom: '0.8rem', padding: 0, overflow: 'hidden' }}>
                <button className="section-toggle" onClick={() => setOpenSection(openSection === si ? -1 : si)}>
                  <span>{section.title || `Sección ${si + 1}`}</span>
                  <span className="mono" style={{ fontSize: '0.7rem' }}>
                    {section.tips.length} tips {openSection === si ? '▾' : '▸'}
                  </span>
                </button>
                {openSection === si && (
                  <div style={{ padding: '0.4rem 1.1rem 1rem' }}>
                    {section.tips.map((tip, ti) => (
                      <div key={ti} className="community-tip">
                        {tip.image && (
                          <a href={tip.imageLink ?? plonkitImageUrl(tip.image)} target="_blank" rel="noreferrer">
                            <img src={plonkitImageUrl(tip.image)} loading="lazy" alt="" />
                          </a>
                        )}
                        <div>
                          {tip.text && <Markdown text={tip.text} />}
                          <div className="chips" style={{ marginTop: '0.4rem' }}>
                            {tip.tags.map((t) => (
                              <span key={t} className="tag" style={{ fontSize: '0.68rem' }}>
                                {t}
                              </span>
                            ))}
                            {tip.imageLink && (
                              <a className="tag" style={{ fontSize: '0.68rem' }} href={tip.imageLink} target="_blank" rel="noreferrer">
                                📍 ubicación ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ))}

      {tab === 'metas' &&
        (geometas === undefined ? (
          <div className="empty">Cargando…</div>
        ) : geometas === null ? (
          <div className="empty">
            Metas no importadas todavía. Ejecuta <code>npm run importar</code> y recarga.
          </div>
        ) : (
          <>
            <p className="import-note">
              Importadas de{' '}
              <a href={geometas.sourceUrl} target="_blank" rel="noreferrer">
                Geometas
              </a>{' '}
              el {geometas.importedAt} · solo uso personal, no redistribuir.
            </p>
            <div className="grid grid-2">
              {geometas.metas.map((m, i) => (
                <div key={i} className="card">
                  {m.image && (
                    <a href={m.svUrl ?? m.image} target="_blank" rel="noreferrer">
                      <img className="meta-img" src={m.image} loading="lazy" alt="" />
                    </a>
                  )}
                  <div className="chips" style={{ margin: '0.5rem 0' }}>
                    <span className="tag" style={{ fontSize: '0.68rem' }}>{m.category}</span>
                    {m.svUrl && (
                      <a className="tag" style={{ fontSize: '0.68rem' }} href={m.svUrl} target="_blank" rel="noreferrer">
                        📍 Street View ↗
                      </a>
                    )}
                  </div>
                  <p style={{ fontSize: '0.9rem', margin: 0 }}>{m.answer}</p>
                  {m.notes && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', margin: '0.4rem 0 0' }}>
                      ⚠ {m.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        ))}
    </div>
  )
}
