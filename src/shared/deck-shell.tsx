import { Deck } from '@revealjs/react'
import type { ReactNode } from 'react'
import 'reveal.js/reveal.css'

const deckConfig = {
  width: 1280,
  height: 720,
  margin: 0.04,
  hash: true,
  controls: true,
  progress: true,
  center: false,
  transition: 'slide' as const,
  backgroundTransition: 'fade' as const,
}

function blurInteractiveControl(): void {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

export function DeckShell({ children }: { children: ReactNode }) {
  function handleSlideChange(): void {
    blurInteractiveControl()
  }

  return (
    <div className="presentation-root" onKeyDownCapture={blurInteractiveControl}>
      <Deck config={deckConfig} onSlideChange={handleSlideChange}>
        {children}
      </Deck>
    </div>
  )
}
