import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Countries from './pages/Countries'
import Maps from './pages/Maps'
import CountryGuide from './pages/CountryGuide'
import Identify from './pages/Identify'
import Compare from './pages/Compare'
import Visual from './pages/Visual'
import Train from './pages/Train'
import Sources from './pages/Sources'

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
          <Route path="/identificar" element={<Identify />} />
          <Route path="/comparar" element={<Compare />} />
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
