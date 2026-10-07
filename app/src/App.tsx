import { DeviceCheck } from './components/DeviceCheck'
import { InstallHint } from './components/InstallHint'
import './App.css'

function App() {
  return (
    <main className="app">
      <header className="top">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width="36" height="36" />
        <h1>GymBro</h1>
      </header>
      <InstallHint />
      <DeviceCheck />
      <p className="muted small footer">v{__APP_VERSION__} · Phase 0</p>
    </main>
  )
}

export default App
