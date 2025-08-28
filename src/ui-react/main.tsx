import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

function mount() {
  const el = document.getElementById('root')
  if (!el) {
    requestAnimationFrame(mount)
    return
  }
  const root = createRoot(el)
  root.render(<App />)
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
