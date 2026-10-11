import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import '@fontsource/orbitron/latin-600.css'
import '@fontsource/orbitron/latin-700.css'
import '@fontsource/exo-2/latin-400.css'
import '@fontsource/exo-2/latin-600.css'
import '@fontsource/share-tech-mono/latin-400.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
