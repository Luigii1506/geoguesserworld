import { HashRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Countries from './pages/Countries'
import Maps from './pages/Maps'
import CountryGuide from './pages/CountryGuide'
import Search from './pages/Search'
import Geography from './pages/Geography'
import Duel from './pages/Duel'
import Visual from './pages/Visual'
import Train from './pages/Train'
import Sources from './pages/Sources'

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
  )
}
