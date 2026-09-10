import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Side-effect import: fills the component registry before the first render.
import './editor/components'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
