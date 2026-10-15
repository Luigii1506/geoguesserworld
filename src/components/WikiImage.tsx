import { useEffect, useRef, useState } from 'react'
import { useWiki } from '../lib/wiki'
import { Img } from './Img'

interface Props {
  title: string
  /** true: carga inmediata; false: espera a entrar en el viewport. */
  eager?: boolean
  className?: string
  showAttribution?: boolean
}

export default function WikiImage({ title, eager = false, className = 'wiki-img', showAttribution = true }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(eager)
  const data = useWiki(title, visible)

  useEffect(() => {
    if (eager || visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [eager, visible])

  return (
    <div ref={ref}>
      {data?.thumb ? (
        <>
          <Img className={className} src={data.thumb} size="img" sizes="(max-width: 700px) 92vw, 780px" alt={data.title} />
          {showAttribution && (
            <div className="wiki-attr">
              📷{' '}
              <a href={data.pageUrl} target="_blank" rel="noreferrer">
                Wikipedia · {data.title}
              </a>{' '}
              (CC BY-SA)
            </div>
          )}
        </>
      ) : data === null ? (
        <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '0.8rem' }}>
          sin imagen disponible
        </div>
      ) : (
        <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '0.8rem' }}>
          cargando…
        </div>
      )}
    </div>
  )
}
