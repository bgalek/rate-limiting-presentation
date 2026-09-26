import { Slide } from '@revealjs/react'
import { DeckShell } from '../shared/deck-shell'
import { SCRIPT } from '../shared/script'
import { DialogueLine, Eyebrow, Notes } from '../shared/ui'

export default function ScriptTextDeck() {
  return (
    <DeckShell>
      <Slide className="interlude" backgroundGradient="linear-gradient(135deg, #4a1731 0%, #160d17 55%, #080d12 100%)">
        <Eyebrow>Bonus material</Eyebrow>
        <h2>Full script: Good cop / Bad cop</h2>
        <div className="versus"><span>bad cop</span><strong>VS</strong><span>good cop</span></div>
        <Notes>Full unabridged dialogue, one line per slide, for anyone who wants to read or reuse the whole bit.</Notes>
      </Slide>

      {SCRIPT.map((line, i) => (
        <Slide key={i} className="dialogue-slide-wrap">
          <Eyebrow>Line {String(i + 1).padStart(2, '0')} / {SCRIPT.length}</Eyebrow>
          <DialogueLine role={line.role}>{line.text}</DialogueLine>
        </Slide>
      ))}
    </DeckShell>
  )
}
