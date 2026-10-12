import { Component, type ReactNode } from 'react'
import { shareBackup } from '../lib/backup'

interface State { error: Error | null }

/**
 * Last line of defence: a rendering error shows this screen instead of a blank app.
 * Data lives in IndexedDB, so it is safe; offer a backup and a reload.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('GymBro crashed', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="app">
        <div className="page">
          <header className="page-head"><h1>Something went wrong</h1></header>
          <section className="card stack">
            <p>This screen hit an error. Your workouts and data are still saved on this phone.</p>
            <button onClick={() => { location.hash = '#/'; location.reload() }}>Reload GymBro</button>
            <button className="secondary" onClick={() => void shareBackup()}>Save a backup first</button>
            <details className="small muted">
              <summary>Error details</summary>
              <pre className="error-detail">{this.state.error.message}</pre>
            </details>
          </section>
        </div>
      </main>
    )
  }
}
