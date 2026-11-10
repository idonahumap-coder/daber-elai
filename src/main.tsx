import '@fontsource/ibm-plex-sans-hebrew/hebrew-300.css'
import '@fontsource/ibm-plex-sans-hebrew/latin-300.css'
import '@fontsource/ibm-plex-sans-hebrew/hebrew-400.css'
import '@fontsource/ibm-plex-sans-hebrew/latin-400.css'
import '@fontsource/ibm-plex-sans-hebrew/hebrew-500.css'
import '@fontsource/ibm-plex-sans-hebrew/latin-500.css'
import '@fontsource/ibm-plex-sans-hebrew/hebrew-600.css'
import '@fontsource/ibm-plex-sans-hebrew/latin-600.css'
import '@fontsource/ibm-plex-sans-hebrew/hebrew-700.css'
import '@fontsource/ibm-plex-sans-hebrew/latin-700.css'
import './lib/sheetDrag'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import App from './App'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload() } })
  setInterval(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()), 60000)
}
