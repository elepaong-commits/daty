import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/push'
import { watchErrors } from './lib/reportError'
import { applyTheme, BOOT_THEME } from './lib/theme'

applyTheme(BOOT_THEME)
registerServiceWorker()
watchErrors()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
