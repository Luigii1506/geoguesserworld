import { Link } from 'react-router-dom'
import { countryFlag, countryLabel, useCountryMap } from '../../lib/data'
import { scopeCounts } from '../../lib/study/cards'
import { confusions, masteryByCountry } from '../../lib/study/stats'
import { useStudy } from '../../lib/study/store'
import { ExamHistory } from './ExamSession'

/** Tu progreso en un país, dentro de su guía: dominio, lo pendiente, tus confusiones y tus exámenes. */
export function CountryProgress({ cc, name }: { cc: string; name: string }) {
  const s = useStudy()
  const map = useCountryMap()
  if (!s.ready) return null
  const m = masteryByCountry(s).get(cc)
  const c = scopeCounts(s, { cc })
  const mixups = confusions(s).filter((x) => x.a === cc || x.b === cc).slice(0, 3)
  const exams = (s.settings.data.exams ?? []).filter((e) => e.cc === cc)
  const last = exams.at(-1)

  if (!m && !c.items && !exams.length) {
    return (
      <aside className="cg-progress empty-progress">
        <span className="eyebrow">Tu progreso</span>
        <p>Aún no estudias {name}. Guarda lo esencial con ☆, o haz un examen para ver tu nivel de partida.</p>
        <Link to={`/entrenar?examen=${cc}`} className="btn btn-sm">Examen de {name}</Link>
      </aside>
    )
  }
  return (
    <aside className="cg-progress">
      <span className="eyebrow">Tu progreso en {name}</span>
      <div className="cg-progress-stats">
        <div><strong>{m ? `${Math.round(m.score * 100)} %` : '—'}</strong><span>dominio</span></div>
        <div><strong>{c.items}</strong><span>guardados</span></div>
        <div><strong>{c.due + c.newAvailable}</strong><span>para hoy</span></div>
        {last && <div><strong>{last.ok}/{last.n}</strong><span>último examen</span></div>}
      </div>
      {exams.length > 1 && <ExamHistory cc={cc} />}
      {mixups.length > 0 && (
        <p className="small">
          Lo confundes con{' '}
          {mixups.map((x, i) => {
            const other = x.a === cc ? x.b : x.a
            return (
              <span key={other}>
                {i > 0 && ', '}
                <Link to={`/duelo?a=${cc}&b=${other}`}>{countryFlag(map, other)} {countryLabel(map, other)}</Link>
              </span>
            )
          })}
        </p>
      )}
      <div className="row">
        {c.items > 0 && <Link to={`/entrenar?estudiar=${cc}`} className="btn btn-primary btn-sm">Estudiar {name}{c.due + c.newAvailable ? ` (${c.due + c.newAvailable})` : ''}</Link>}
        <Link to={`/entrenar?examen=${cc}`} className="btn btn-sm">Examen</Link>
      </div>
    </aside>
  )
}
