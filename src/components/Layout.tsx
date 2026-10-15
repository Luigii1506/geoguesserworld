import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useProgress } from '../lib/storage'
import { isDue } from '../lib/sm2'
import { setLang, useLang } from '../lib/i18n'

// Navegación en el orden del plan: estudiar → identificar / distinguir gemelos → entrenar.
const NAV = [
  { to: '/paises', label: 'Países' },
  { to: '/mapas', label: 'Mapas' },
  { to: '/geografia', label: 'Geografía' },
  { to: '/buscar', label: 'Buscar' },
  { to: '/duelo', label: 'Duelos' },
  { to: '/entrenar', label: 'Entrenar' },
]

type Theme = 'auto' | 'light' | 'dark'
const THEME_LABEL: Record<Theme, string> = { auto: 'Auto', light: 'Claro', dark: 'Oscuro' }

export default function Layout() {
  const progress = useProgress()
  const lang = useLang()
  const location = useLocation()
  const due = Object.entries(progress.srs).filter(([k, s]) => k.includes(':') && isDue(s)).length
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('geomastery.theme') as Theme) || 'auto'
    } catch {
      return 'auto'
    }
  })

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('geomastery.theme', theme)
    } catch {
      /* sin almacenamiento */
    }
  }, [theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">GeoMastery</Link>
          <nav className="nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                // la guía de un país (/pais/xx) también es parte de "Países"
                className={({ isActive }) => (isActive || (item.to === '/paises' && location.pathname.startsWith('/pais/')) ? 'active' : '')}
              >
                {item.label}
                {item.to === '/entrenar' && due > 0 && <span className="count">{due}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-tools">
            <div className="seg seg-sm" role="group" aria-label="Idioma de las pistas">
              <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <button
              className="btn btn-quiet theme"
              onClick={() => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))}
              title="Tema"
            >
              {THEME_LABEL[theme]}
            </button>
          </div>
        </div>
      </header>
      <main className="page">
        {/* cada página se descarga al visitarla (React.lazy en App.tsx) */}
        <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="footer">
        <span>GeoMastery · uso personal</span>
        <Link to="/fuentes">Fuentes y licencias</Link>
      </footer>
    </>
  )
}
