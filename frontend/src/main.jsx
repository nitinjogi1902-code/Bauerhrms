import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import './MobileResponsive.css'

// Apply the mobile-only stylesheet layer only when HRSYNC is installed
// as a PWA (Android/iOS home-screen app) or running as a Capacitor app.
// Normal browser tabs keep the existing desktop website layout.
const isInstalledPWA =
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

const isNativeApp = Capacitor.isNativePlatform()

if (isInstalledPWA || isNativeApp) {
  document.documentElement.classList.add('native-app')
}

// Register the PWA service worker in browsers only. Capacitor continues to
// use its own bundled assets. Updates ask before reloading so an in-progress
// HR/payroll form is not discarded unexpectedly.
if (!isNativeApp) {
  let updateServiceWorker = () => Promise.resolve()

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      const shouldUpdate = window.confirm(
        'A new HRSYNC version is available. Reload now to update the app?'
      )
      if (shouldUpdate) updateServiceWorker(true)
    },
    onOfflineReady() {
      console.info('HRSYNC app shell is ready for offline launch. Live HR data still needs internet access.')
    },
    onRegisterError(error) {
      console.error('HRSYNC service worker registration failed:', error)
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
