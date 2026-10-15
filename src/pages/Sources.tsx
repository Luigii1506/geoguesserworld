import { SOURCES } from '../data/sources'
import { useMeta } from '../lib/data'
import { geo, useGeo } from '../lib/geo'

// Qué aporta cada fuente de la base geográfica (licencia y cita vienen de la tabla source, vía geo/meta)
const GEO_ROLE: Record<string, string> = {
  countries: 'países: nombres, capitales, idiomas, monedas',
  naturalearth: 'fronteras, regiones, llanuras, mesetas, desiertos y mares',
  wikidata: 'identidad, nombres en varios idiomas y coordenadas',
  'wikidata-enrich': 'fotos, población, altitud y otros datos de cada lugar',
  wikipedia: 'resúmenes de cada lugar',
  gvp: 'volcanes: tipo, estado y última erupción',
  geonames: 'ciudades, pueblos y accidentes geográficos',
  ghsl: 'áreas urbanas y su población',
  gmba: 'cordilleras y sierras',
  hydrolakes: 'lagos y su superficie',
  hydrorivers: 'ríos en los mapas de cada país',
  resolve: 'ecorregiones y biomas',
  etopo: 'relieve y formas del terreno',
  worldcover: 'cobertura del suelo: bosque, cultivo, ciudad…',
  koppen: 'climas',
  mapspam: 'dónde se cultiva cada producto',
  atlas: 'mapas por país hechos a partir de las capas anteriores',
}
// las pistas y guías de la comunidad ya salen en las secciones de abajo
const COMMUNITY = new Set(['hints', 'guides'])

export default function Sources() {
  const meta = useMeta()
  const geoMeta = useGeo('meta', geo.meta)
  const t = meta?.totals
  const order = Object.keys(GEO_ROLE)
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
  const geoSources = (geoMeta.data?.sources ?? []).filter((s) => !COMMUNITY.has(s.id)).sort((a, b) => rank(a.id) - rank(b.id))

  return (
    <div>
      <header className="page-head">
        <h1>Fuentes y licencias</h1>
        <p className="lead">
          Las pistas vienen de seis guías de la comunidad: se extraen, se quita lo repetido, se revisa cada pista y se
          traduce, y cada una conserva su fuente y un enlace al original. La geografía (lugares, relieve, climas, cultivos…)
          sale de bases de datos abiertas.
        </p>
      </header>

      {t && (
        <div className="stat-line" style={{ marginBottom: '2rem' }}>
          <div><strong>{t.hints.toLocaleString('es')}</strong><span>pistas extraídas</span></div>
          <div><strong>{t.groups.toLocaleString('es')}</strong><span>únicas</span></div>
          <div><strong>{t.images.toLocaleString('es')}</strong><span>imágenes</span></div>
          <div><strong>{meta.generatedAt}</strong><span>última exportación</span></div>
        </div>
      )}

      <p className="note" style={{ marginBottom: '2.4rem' }}>
        Uso personal, con permiso de cada guía de la comunidad. Muchas de sus imágenes son capturas de Google Street View.
        Los textos de Wikipedia se publican bajo CC BY-SA 4.0 y cada ficha enlaza a su artículo.
      </p>

      {geoSources.length > 0 && (
        <section className="filter-group" style={{ marginBottom: '2.4rem' }}>
          <h2>Datos geográficos</h2>
          <div className="table-wrap">
            <table className="table table-stack">
              <thead><tr><th>Fuente</th><th>Aporta</th><th>Licencia y cita</th></tr></thead>
              <tbody>
                {geoSources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}
                      {s.version && <span className="muted small"> · {s.version}</span>}
                    </td>
                    <td>{GEO_ROLE[s.id] ?? ''}</td>
                    <td className="muted small">{s.license}<br />{s.attribution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {meta && (
        <section className="filter-group" style={{ marginBottom: '2.4rem' }}>
          <h2>Cómo se extrae cada guía</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fuente</th><th>Método</th><th>Licencia</th></tr></thead>
              <tbody>
                {meta.sources.map((s) => (
                  <tr key={s.id}>
                    <td><a href={s.homepage} target="_blank" rel="noreferrer">{s.name}</a></td>
                    <td>{s.method}</td>
                    <td className="muted">{s.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="filter-group">
        <h2>Qué aporta cada guía</h2>
        <div className="grid grid-2">
          {SOURCES.map((s) => (
            <div key={s.id} className="panel source-card">
              <h3><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> <span className="muted small">· {s.type}</span></h3>
              <p className="small">{s.summary}</p>
              <dl>
                <dt>Cobertura</dt><dd>{s.coverage}</dd>
                <dt>Limitaciones</dt><dd>{s.limitations}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
