import { Slide } from '@revealjs/react'
import { BurstOutcomeDemo } from '../cop-arena/BurstOutcomeDemo'
import { CopArena } from '../cop-arena/CopArena'
import { DbFailureDemo } from '../cop-arena/DbFailureDemo'
import { EdgeCacheDemo } from '../cop-arena/EdgeCacheDemo'
import { SequentialCounterDemo } from '../cop-arena/SequentialCounterDemo'
import { DeckShell } from '../shared/deck-shell'
import { SCRIPT } from '../shared/script'
import { Notes } from '../shared/ui'

// Whose turn it is reads from the slide background instead of an on-screen badge —
// dark red for the bad cop, dark green for the good cop.
const TURN_BACKGROUND = {
  bad: 'linear-gradient(160deg, #6b1220 0%, #1a0a0d 80%)',
  good: 'linear-gradient(160deg, #164a2c 0%, #0c1811 80%)',
}

// Per-beat background overrides, independent of whose turn it is.
const BACKGROUND_OVERRIDE: Record<number, string> = {
  13: TURN_BACKGROUND.good,
}

export default function ScriptVisualDeck() {
  return (
    <DeckShell>
      <Slide backgroundGradient="linear-gradient(135deg, #4a1731 0%, #160d17 55%, #080d12 100%)">
        <CopArena beat={0} />
        <Notes>Same 35-line script, no text on screen — the arena carries the story while the dialogue stays in these notes.</Notes>
      </Slide>

      {SCRIPT.flatMap((line, i) => {
        const beat = i + 1
        // Beat 11 ("let me think, think, think...") is dropped from the deck entirely.
        const slides = beat === 11 ? [] : [
          <Slide key={i} backgroundGradient={BACKGROUND_OVERRIDE[beat] ?? TURN_BACKGROUND[line.role]}>
            <CopArena beat={beat} />
            <Notes>{`${line.role === 'good' ? 'Good cop' : 'Bad cop'}: ${line.text}`}</Notes>
          </Slide>,
        ]
        // Beat 12 (the sequential test) gets a zoomed-in follow-up slide, not another
        // line of dialogue — same beat, closeup on the counter's remaining-budget log.
        if (beat === 12) {
          slides.push(
            <Slide key={`${i}-sequential-log`} backgroundGradient={TURN_BACKGROUND[line.role]}>
              <SequentialCounterDemo />
              <Notes>Continued from the sequential test — zoomed into the shared counter, showing X-RateLimit-Remaining ticking down out of order as requests land one at a time.</Notes>
            </Slide>,
          )
        }
        // Beat 13 (the burst test) gets two follow-up slides showing how the shared
        // counter handles it depending on how it's implemented: racily (dropped
        // updates let more through than the limit allows) or atomically (correct
        // no matter how concurrently the requests land).
        if (beat === 13) {
          slides.push(
            <Slide key={`${i}-burst-race`} backgroundGradient={TURN_BACKGROUND.bad}>
              <BurstOutcomeDemo admitted={115} rejected={85} />
              <Notes>Continued from the burst test — a non-atomic counter races: concurrent requests each read the count before any of them write it back, so more get through than the limit allows.</Notes>
            </Slide>,
            <Slide key={`${i}-burst-atomic`} backgroundGradient={TURN_BACKGROUND.good}>
              <BurstOutcomeDemo atomic admitted={100} rejected={100} />
              <Notes>Same burst, but the counter's check-and-increment is atomic — however concurrently the requests land, exactly 100 get through and the rest are correctly rejected.</Notes>
            </Slide>,
            <Slide key={`${i}-db-failure`} backgroundGradient={TURN_BACKGROUND.bad}>
              <DbFailureDemo />
              <Notes>The store itself is a single point of failure: atomicity only protects its bookkeeping, not its survival — a few seconds in, it blows up outright, and once the smoke clears, nothing is left to forward requests to.</Notes>
            </Slide>,
            <Slide key={`${i}-edge-cache`} backgroundGradient={TURN_BACKGROUND.good}>
              <EdgeCacheDemo />
              <Notes>Give every edge server its own local copy of the store (the corner badge) and that single point of failure disappears — requests are served straight off the local copy, and only a slow background heartbeat, one edge at a time, keeps those copies in sync.</Notes>
            </Slide>,
          )
        }
        return slides
      })}
    </DeckShell>
  )
}
