import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ScriptTextDeck from './decks/ScriptTextDeck.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScriptTextDeck />
  </StrictMode>,
)
