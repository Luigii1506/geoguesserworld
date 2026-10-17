import { useState } from 'react'
import { KIND_LABEL, LEVEL_LABEL, USE_HINT, USE_LABEL, type ExternalGuide } from '../lib/resources'

/** Una guía externa: título que abre el original, quién la hizo, qué es y para qué nivel. */
export function ExternalGuideRow({ g, flag }: { g: ExternalGuide; flag?: string }) {
  const [open, setOpen] = useState(false)
  const long = (g.d?.length ?? 0) > 180
  return (
    <article className={`xg ${g.use === 'old' ? 'xg-old' : ''}`}>
      <div className="xg-head">
        {flag && <span className="xg-flag" aria-hidden="true">{flag}</span>}
        <div className="xg-main">
          <a className="xg-title" href={g.u} target="_blank" rel="noreferrer">{g.t}<span aria-hidden="true"> ↗</span></a>
          <span className="xg-meta">
            {[g.a, KIND_LABEL[g.k], g.m ? (g.m >= 60 ? `${Math.floor(g.m / 60)} h ${g.m % 60 ? `${g.m % 60} min` : ''}` : `${g.m} min`) : null].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
      <div className="xg-tags">
        {g.start && <span className="xg-tag xg-start">Empieza por aquí</span>}
        {g.lv && <span className={`xg-tag xg-lv-${g.lv}`}>{LEVEL_LABEL[g.lv]}</span>}
        {g.use && <span className={`xg-tag xg-use-${g.use}`} title={USE_HINT[g.use]}>{USE_LABEL[g.use]}</span>}
      </div>
      {g.d && (
        <p className={`xg-desc ${open || !long ? 'open' : ''}`} onClick={() => long && setOpen(!open)}>
          {g.d}
        </p>
      )}
      {g.parts && (
        <p className="xg-parts">
          También: {g.parts.map((p, i) => <span key={p.u}>{i > 0 && ' · '}<a href={p.u} target="_blank" rel="noreferrer">{p.t}</a></span>)}
        </p>
      )}
      {g.dc && <p className="xg-note">Archivo de Discord: estos enlaces caducan. Si no abre, búscalo en la hoja original o en el Discord de Plonk It.</p>}
    </article>
  )
}
