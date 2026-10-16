import { lazy } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import AuthGate from './components/AuthGate'

// cada página en su propio archivo: al abrir la app solo se descarga la que se ve
const Home = lazy(() => import('./pages/Home'))
const Countries = lazy(() => import('./pages/Countries'))
const Maps = lazy(() => import('./pages/Maps'))
const CountryGuide = lazy(() => import('./pages/CountryGuide'))
const Search = lazy(() => import('./pages/Search'))
const Geography = lazy(() => import('./pages/Geography'))
const Duel = lazy(() => import('./pages/Duel'))
const Visual = lazy(() => import('./pages/Visual'))
const Catalog = lazy(() => import('./pages/Catalog'))
const Train = lazy(() => import('./pages/Train'))
const Sources = lazy(() => import('./pages/Sources'))

// las antiguas páginas de tema y del explorador son ahora la propia guía (una sola página)
function GuideRedirect() {
  const { code } = useParams()
  const [params] = useSearchParams()
  params.delete('tema')
  params.delete('sub')
  params.delete('vista')
  const qs = params.toString()
  return <Navigate to={`/pais/${code}${qs ? `?${qs}` : ''}`} replace />
}

// la antigua comparación (?c=us,ca) es ahora el duelo entre los dos primeros países
function CompareRedirect() {
  const [params] = useSearchParams()
  const [a, b] = (params.get('c') ?? '').split(',')
  return <Navigate to={a && b ? `/duelo?a=${a}&b=${b}` : '/duelo'} replace />
}

export default function App() {
  return (
    <AuthGate>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/paises" element={<Countries />} />
          <Route path="/mapas" element={<Maps />} />
          <Route path="/pais/:code" element={<CountryGuide />} />
          <Route path="/pais/:code/tema/:cat" element={<GuideRedirect />} />
          <Route path="/pais/:code/explorar" element={<GuideRedirect />} />
          <Route path="/buscar" element={<Search />} />
          <Route path="/geografia" element={<Geography />} />
          <Route path="/identificar" element={<Navigate to="/buscar" replace />} />
          <Route path="/duelo" element={<Duel />} />
          <Route path="/comparar" element={<CompareRedirect />} />
          <Route path="/explorar" element={<Visual />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/entrenar" element={<Train />} />
          <Route path="/fuentes" element={<Sources />} />
          {/* rutas de la versión anterior */}
          <Route path="/visual" element={<Navigate to="/explorar" replace />} />
          <Route path="/repaso" element={<Navigate to="/entrenar" replace />} />
          <Route path="/practica" element={<Navigate to="/entrenar" replace />} />
          <Route path="/academia" element={<Navigate to="/paises" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </HashRouter>
    </AuthGate>
  )
}
