import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ClearSkiesApp from './ClearSkiesApp'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClearSkiesApp />
  </StrictMode>
)