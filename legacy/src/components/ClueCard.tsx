import { Link } from 'react-router-dom'
import type { Clue } from '../data/types'
import { CATEGORY_MAP } from '../data/categories'
import { countryFlag } from '../data/countries'
import { ConfidenceBadge, MASTERY_LABELS } from './Badges'
import { useProgress } from '../lib/storage'

export default function ClueCard({ clue }: { clue: Clue }) {
  const progress = useProgress()
  const mastery = progress.clueMastery[clue.id] ?? 0
  const cat = CATEGORY_MAP.get(clue.category)
  return (
    <Link to={`/pista/${clue.id}`} className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <h3 className="card-title">
          <span>{cat?.icon}</span> {clue.name}
        </h3>
        <ConfidenceBadge level={clue.confidence} />
      </div>
      <p className="card-desc">{clue.howToUse.length > 140 ? clue.howToUse.slice(0, 140) + '…' : clue.howToUse}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
        <span style={{ fontSize: '0.95rem', letterSpacing: '0.1em' }}>
          {clue.countries.slice(0, 6).map((c) => countryFlag(c)).join(' ')}
          {clue.countries.length > 6 && <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}> +{clue.countries.length - 6}</span>}
        </span>
        {mastery > 0 && (
          <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {MASTERY_LABELS[mastery]}
          </span>
        )}
      </div>
    </Link>
  )
}
