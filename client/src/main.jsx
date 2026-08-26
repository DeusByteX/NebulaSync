import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Progressive Web App (PWA) Service Worker for mobile + PC installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('NebulaSync PWA Service Worker active:', reg.scope))
      .catch((err) => console.warn('PWA Service Worker registration bypassed:', err));
  });
}
