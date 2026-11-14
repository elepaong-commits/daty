import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/push'
import { watchErrors } from './lib/reportError'
import { applyTheme, BOOT_THEME } from './lib/theme'
import { watchColorMode } from './lib/colorMode'

applyTheme(BOOT_THEME)
watchColorMode()
registerServiceWorker()
watchErrors()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
