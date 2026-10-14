import { Link } from 'react-router-dom'
import type { Confidence } from '../data/types'
import { countryFlag, countryName } from '../data/countries'

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  fuerte: 'Evidencia fuerte',
  moderada: 'Evidencia moderada',
  debil: 'Evidencia débil',
  contextual: 'Indicio contextual',
  meta: 'Meta · puede caducar',
  verificar: 'Necesita verificación',
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return <span className={`badge badge-${level}`}>{CONFIDENCE_LABEL[level]}</span>
}

export function CountryChips({ codes, max }: { codes: string[]; max?: number }) {
  const shown = max ? codes.slice(0, max) : codes
  const rest = max && codes.length > max ? codes.length - max : 0
  return (
    <span className="chips">
      {shown.map((code) => (
        <Link key={code} to={`/pais/${code}`} className="tag">
          <span className="flag">{countryFlag(code)}</span> {countryName(code)}
        </Link>
      ))}
      {rest > 0 && <span className="tag">+{rest}</span>}
    </span>
  )
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  )
}

export const MASTERY_LABELS = ['Nueva', 'Vista', 'Aprendiendo', 'Dominada'] as const
