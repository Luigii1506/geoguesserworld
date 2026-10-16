import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isStaleChunk, reloadForNewVersion } from '../lib/staleChunk'

// Un fallo en una vista no debe dejar la página en blanco: se muestra el
// error y se puede volver al inicio.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // una versión nueva publicada mientras la app estaba abierta: se recarga sola
    if (isStaleChunk(error) && reloadForNewVersion()) return
    console.error('[GeoMastery]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    if (isStaleChunk(this.state.error)) {
      return (
        <div className="page page-narrow">
          <div className="panel" style={{ display: 'grid', gap: '0.8rem' }}>
            <h2>Hay una versión nueva de GeoMastery</h2>
            <p className="muted">Se publicó mientras tenías la app abierta. Recarga para usarla (tu estudio está guardado).</p>
            <div className="row"><button className="btn btn-primary" onClick={() => location.reload()}>Recargar</button></div>
          </div>
        </div>
      )
    }
    return (
      <div className="page page-narrow">
        <div className="panel" style={{ display: 'grid', gap: '0.8rem' }}>
          <h2>Algo falló en esta vista</h2>
          <p className="muted">{this.state.error.message}</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => location.reload()}>Recargar</button>
            <a className="btn" href="#/" onClick={() => this.setState({ error: null })}>Ir al inicio</a>
          </div>
        </div>
      </div>
    )
  }
}
