import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const container = document.getElementById('root')

// Reuse the existing root across Vite HMR reloads.
// Calling createRoot() twice on the same container blanks the screen.
if (!globalThis.__finpilotRoot) {
  globalThis.__finpilotRoot = createRoot(container)
}

globalThis.__finpilotRoot.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
