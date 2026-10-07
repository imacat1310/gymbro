import { useState } from 'react'
import { DeviceCheck } from './components/DeviceCheck'
import { InstallHint } from './components/InstallHint'
import { PoseTest } from './components/PoseTest'
import './App.css'

type Tab = 'check' | 'pose'

function App() {
  const [tab, setTab] = useState<Tab>('check')

  return (
    <main className="app">
      <header className="top">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width="36" height="36" />
        <h1>GymBro</h1>
      </header>
      <InstallHint />
      <nav className="tabs">
        <button className={tab === 'check' ? 'active' : ''} onClick={() => setTab('check')}>Device check</button>
        <button className={tab === 'pose' ? 'active' : ''} onClick={() => setTab('pose')}>Pose test</button>
      </nav>
      {tab === 'check' ? <DeviceCheck /> : <PoseTest />}
      <p className="muted small footer">v{__APP_VERSION__} · Phase 0</p>
    </main>
  )
}

export default App
