import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { savedItems, useStudy } from '../lib/study/store'
import { dueCount } from '../lib/study/cards'
import { setLang, useLang } from '../lib/i18n'
import { useUser } from '../lib/auth'
import { ICONS, MobileMenu, type MenuGroup } from './MobileMenu'
import { GlobalSearch } from './GlobalSearch'
import { Loading } from './ui'
import { isIos, useInstall, useOnline } from '../lib/install'

// Navegación en el orden del plan: estudiar → identificar / distinguir gemelos → entrenar.
const NAV = [
  { to: '/paises', label: 'Países' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/guias', label: 'Guías' },
  { to: '/mapas', label: 'Mapas' },
  { to: '/geografia', label: 'Geografía' },
  { to: '/buscar', label: 'Buscar' },
  { to: '/duelo', label: 'Duelos' },
  { to: '/guardados', label: 'Guardados' },
  { to: '/entrenar', label: 'Entrenar' },
]

type Theme = 'auto' | 'light' | 'dark'
const THEME_LABEL: Record<Theme, string> = { auto: 'Auto', light: 'Claro', dark: 'Oscuro' }

export default function Layout() {
  const study = useStudy()
  const { user, signOut } = useUser()
  const lang = useLang()
  const location = useLocation()
  const due = dueCount(study)
  const saved = savedItems(study).length
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

  // al volver atrás (o adelante), la página vuelve a donde estabas; al ir a otra, arriba.
  // Cambiar solo los filtros (?…) no mueve la página.
  const navType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const lastPath = useRef(location.pathname)
  // se cambia de escucha antes de pintar la página nueva: si no, el recorte del scroll al
  // acortarse la página se guardaría como la posición de la anterior
  useLayoutEffect(() => {
    const key = location.key
    const save = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [location.key])
  useEffect(() => {
    const samePage = lastPath.current === location.pathname
    lastPath.current = location.pathname
    const target = navType === 'POP' ? positions.current.get(location.key) : undefined
    if (target === undefined) {
      if (!samePage) window.scrollTo(0, 0)
      return
    }
    // el contenido llega en partes: se reintenta hasta que la página es lo bastante alta (máx. ~2 s)
    let frames = 0
    let raf = 0
    const restore = () => {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) > 4 && ++frames < 120) raf = requestAnimationFrame(restore)
    }
    restore()
    return () => cancelAnimationFrame(raf)
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const online = useOnline()
  const install = useInstall()

  // la app instalada muestra en su icono cuántas tarjetas tocan (donde el sistema lo permite)
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (!study.ready) return
    if (due > 0) nav.setAppBadge?.(due).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }, [due, study.ready])

  // el menú del móvil, por grupos (en escritorio, la barra superior)
  const groups: MenuGroup[] = [
    {
      title: 'Aprender',
      items: [
        { to: '/', label: 'Inicio', icon: ICONS.home, match: (p) => p === '/' },
        { to: '/paises', label: 'Países', icon: ICONS.countries, match: (p) => p.startsWith('/pais/') },
        { to: '/catalogo', label: 'Catálogo', icon: ICONS.catalog },
        { to: '/guias', label: 'Guías externas', icon: ICONS.guides },
        { to: '/duelo', label: 'Duelos', icon: ICONS.duel },
        { to: '/guardados', label: 'Guardados', icon: ICONS.saved, count: saved },
        { to: '/entrenar', label: 'Entrenar', icon: ICONS.train, count: due },
      ],
    },
    {
      title: 'Explorar',
      items: [
        { to: '/geografia', label: 'Geografía', icon: ICONS.geography },
        { to: '/mapas', label: 'Mapas', icon: ICONS.maps },
        { to: '/buscar', label: '¿Dónde estoy?', icon: ICONS.search },
        { to: '/explorar', label: 'Fotos', icon: ICONS.photos },
      ],
    },
  ]
  const nextTheme = () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))
  const drawerFoot = (
    <>
      <NavLink to="/fuentes" className="drawer-item">
        <span className="drawer-icon" aria-hidden="true">{ICONS.sources}</span><span>Fuentes y licencias</span>
      </NavLink>
      <button className="drawer-item" onClick={nextTheme}>
        <span className="drawer-icon" aria-hidden="true">◐</span><span>Tema: {THEME_LABEL[theme].toLowerCase()}</span>
      </button>
      {install.mode === 'prompt' && (
        <button className="drawer-item drawer-install" onClick={() => void install.install()}>
          <span className="drawer-icon" aria-hidden="true">⤓</span><span>Instalar la app<small>Abre al instante y funciona sin conexión</small></span>
        </button>
      )}
      {install.mode === 'ios' && isIos() && (
        <div className="drawer-item drawer-install drawer-tip">
          <span className="drawer-icon" aria-hidden="true">⤓</span>
          <span>Instalar la app<small>En Safari: Compartir → «Añadir a pantalla de inicio»</small></span>
        </div>
      )}
      {user && (
        <button className="drawer-item drawer-out" onClick={signOut}>
          <span className="drawer-icon" aria-hidden="true">↩</span>
          <span>Salir<small>{user.email}</small></span>
        </button>
      )}
    </>
  )

  return (
    <>
      <a href="#contenido" className="skip-link" onClick={(e) => (e.preventDefault(), document.getElementById('contenido')?.focus())}>Saltar al contenido</a>
      <header className="topbar">
        <div className="topbar-inner">
          <MobileMenu groups={groups} footer={drawerFoot} due={due} />
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
            <GlobalSearch />
            <div className="seg seg-sm" role="group" aria-label="Idioma de las pistas">
              <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <button className="btn btn-quiet theme" onClick={nextTheme} title="Tema">
              {THEME_LABEL[theme]}
            </button>
            {user && (
              <button className="btn btn-quiet signout" onClick={signOut} title={`Salir (${user.email})`}>
                Salir
              </button>
            )}
          </div>
        </div>
      </header>
      {!online && <div className="offline-bar" role="status">Sin conexión: ves lo que ya tenías guardado en este dispositivo. Tus repasos se enviarán al volver.</div>}
      <main className="page" id="contenido" tabIndex={-1}>
        {/* cada página se descarga al visitarla (React.lazy en App.tsx) */}
        <Suspense fallback={<Loading what="la página" />}>
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
