import { SOURCES } from '../data/sources'
import { useMeta } from '../lib/data'

export default function Sources() {
  const meta = useMeta()
  const t = meta?.totals

  return (
    <div>
      <header className="page-head">
        <h1>Fuentes y licencias</h1>
        <p className="lead">
          GeoMastery reúne seis fuentes de la comunidad: las extrae, quita lo repetido, revisa cada pista y la traduce. Cada
          pista conserva su fuente y un enlace al original.
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
        Solo para uso personal. Ninguna de estas fuentes publica una licencia abierta para su contenido y muchas imágenes
        son capturas de Google Street View. Los datos viven en tu máquina (<code>data/</code> y <code>public/community/</code>,
        fuera de git) y las imágenes se cargan desde los servidores originales. Las fotos de lugares vienen de Wikipedia
        (CC BY-SA) y los datos de países de mledoze/countries (ODbL) y Wikidata (CC0).
      </p>

      {meta && (
        <section className="filter-group" style={{ marginBottom: '2.4rem' }}>
          <h2>Cómo se extrae cada fuente</h2>
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
        <h2>Qué aporta cada sitio</h2>
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
