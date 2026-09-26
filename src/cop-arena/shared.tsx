import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AlgorithmVisualization, FixedWindowVisualization, type VisualizationController } from '../rate-limit-visualizations'
import { LEGIT_LIMIT, LEGIT_WINDOW_MS } from './load-model'

export type Speaker = 'bad' | 'good'

export function Scoreboard({ ok, rejected }: { ok: string; rejected: string }) {
  return (
    <div className="arena-scoreboard">
      <div className="metric"><span>admitted</span><strong>{ok}</strong></div>
      <div className="metric metric--yellow"><span>rejected</span><strong>{rejected}</strong></div>
    </div>
  )
}

// The last row fades out to suggest the botnet continues past what's drawn, not stops there.
const IP_TILES = ['198.51.100.23', '203.0.113.87', '192.0.2.14', '198.51.100.201']
export const BOTNET_TOTAL = 10_000

// Real request-by-request canvases (dots crossing a window, admitted vs rejected),
// reused verbatim from how MainDeck.tsx's IdentityDemo/WindowBoundaryDemo configure
// them — stateless and phase-driven here since the arena has no play/reset buttons.

// Round 1 (identity): one steady legit row, plus — once the botnet shows up — the
// same rows either each keeping their own budget ('attack') or collapsing onto one
// shared budget ('fixed'). 'idle' is the pre-story baseline: legit traffic only.
export function IdentityAlgorithmView({ phase }: { phase: 'idle' | 'attack' | 'fixed' }) {
  const attackerLimit = phase === 'fixed' ? 1 : LEGIT_LIMIT
  return (
    <div className="identity-row-list identity-row-list--arena" style={{ width: '100%' }}>
      <div className="identity-row identity-row--legit">
        <span className="identity-row-label">legit user</span>
        <FixedWindowVisualization
          className="identity-row-canvas"
          limit={attackerLimit}
          windowMs={LEGIT_WINDOW_MS}
          height={80}
          steadyMode
          hideControls
          showBoundaryLabels={false}
        />
      </div>
      {phase !== 'idle' && IP_TILES.map((ip, i) => (
        <div
          key={ip}
          className={`identity-row${i === IP_TILES.length - 1 ? ' identity-row--more' : ''}`}
          style={{ '--hue': i * 65 } as CSSProperties}
        >
          <span className="identity-row-label">{ip}</span>
          <FixedWindowVisualization
            className="identity-row-canvas"
            limit={attackerLimit}
            windowMs={LEGIT_WINDOW_MS}
            height={80}
            steadyMode
            hideControls
            showBoundaryLabels={false}
          />
        </div>
      ))}
      {phase !== 'idle' && <div className="botnet-more">+{(BOTNET_TOTAL - IP_TILES.length).toLocaleString()} more IPs</div>}
    </div>
  )
}

const HERD_LABELS = ['bad user 01', 'bad user 02']
// This demo needs its own (shorter) window than LEGIT_WINDOW_MS: the exploit only
// works with one full idle window between attacks (see useBoundaryDoubleBurst), so
// halving the window halves the wait before a live audience sees the next burst.
const BOUNDARY_DEMO_WINDOW_MS = 2_500
// Spacing between hits within one burst — slow enough to read as a wave of dots
// crossing the canvas, not an instant, illegible blur.
const BOUNDARY_HIT_INTERVAL_MS = 100

// Drives one herd row's canvas by calling its controller's `hit()` directly, timed
// so a full `limit`-sized burst lands back-to-back right before AND another right
// after every OTHER window boundary — one window bursts, the next sits idle, then
// it repeats. Boundaries/windows are computed the same way FixedWindowLimiter does
// (`floor(now / windowMs)`), so the bursts stay aligned to the canvas's own clock,
// and the even/odd split is derived from that same absolute clock so both herd rows
// burst and idle in lockstep. (The "before" burst usually gets rejected — the
// "after" burst for the same window already spent its quota at the start — which
// is itself the point: only the reset at the boundary lets a fresh wave back in.)
function useBoundaryDoubleBurst(windowMs: number, limit: number) {
  const controllerRef = useRef<VisualizationController | null>(null)
  const frameRef = useRef(0)
  const lastWindowIndexRef = useRef(-1)
  const beforeHitsRef = useRef(0)
  const afterHitsRef = useRef(0)

  const onControllerReady = useCallback((controller: VisualizationController | null) => {
    controllerRef.current = controller
    cancelAnimationFrame(frameRef.current)
    if (controller === null) {
      return
    }

    lastWindowIndexRef.current = -1
    beforeHitsRef.current = 0
    afterHitsRef.current = 0

    function tick(): void {
      const now = performance.now()
      const windowIndex = Math.floor(now / windowMs)

      if (windowIndex !== lastWindowIndexRef.current) {
        lastWindowIndexRef.current = windowIndex
        beforeHitsRef.current = 0
        afterHitsRef.current = 0
      }

      // The two halves must straddle one real boundary between two *adjacent*
      // windows (only `interval` ms apart), not sit at the two ends of the same
      // window (~windowMs apart) — otherwise a fixed window rejects the second half
      // on its own (same counter), and a sliding window behaves identically, so
      // neither algorithm ever looks different from the other.
      if (windowIndex % 2 === 0) {
        // Even window: the "before" half, timed to land exactly at this window's
        // closing boundary.
        const windowEnd = (windowIndex + 1) * windowMs
        const beforeBurstStart = windowEnd - limit * BOUNDARY_HIT_INTERVAL_MS
        if (beforeHitsRef.current < limit && now >= beforeBurstStart + beforeHitsRef.current * BOUNDARY_HIT_INTERVAL_MS) {
          controllerRef.current?.hit()
          beforeHitsRef.current += 1
        }
      } else {
        // Odd window: the "after" half, timed to land exactly at this window's
        // opening boundary — the same boundary the previous (even) window's
        // before-burst just ended at.
        const afterBurstStart = windowIndex * windowMs
        if (afterHitsRef.current < limit && now >= afterBurstStart + afterHitsRef.current * BOUNDARY_HIT_INTERVAL_MS) {
          controllerRef.current?.hit()
          afterHitsRef.current += 1
        }
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [windowMs, limit])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  return onControllerReady
}

// Mirrors useBoundaryDoubleBurst's exact window/burst-span math so other UI (e.g. a
// topology node reacting to "a spike is landing right now") can stay in lockstep
// with the live canvases without an event bus between the two.
function isBoundaryBurstActive(now: number): boolean {
  const windowIndex = Math.floor(now / BOUNDARY_DEMO_WINDOW_MS)
  const windowStart = windowIndex * BOUNDARY_DEMO_WINDOW_MS
  const windowEnd = windowStart + BOUNDARY_DEMO_WINDOW_MS
  const burstSpanMs = LEGIT_LIMIT * BOUNDARY_HIT_INTERVAL_MS
  return windowIndex % 2 === 0 ? now >= windowEnd - burstSpanMs : now <= windowStart + burstSpanMs
}

/** True while a boundary burst is actively landing; false the rest of the time. */
export function useBoundaryBurstPulse(enabled: boolean): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let frame = 0
    function tick(): void {
      const next = isBoundaryBurstActive(performance.now())
      setActive((prev) => (prev === next ? prev : next))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled])

  return active
}

export type TokenAttackConfig = {
  /** Starting/max token budget. */
  max: number
  /** Tokens spent by each admitted ball. */
  cost: number
  /** How many balls (in spawn order) ever get admitted — every ball after that is rejected. */
  admitCount: number
  /** Gap between one ball spawning and the next. */
  intervalMs: number
  /** Time from a ball spawning to it reaching the server and disappearing. */
  travelMs: number
}

export type AttackBall = { id: number; admitted: boolean }

type TokenAttackState = { remaining: number; admitted: number; rejected: number; balls: AttackBall[] }

function initialAttackState(max: number): TokenAttackState {
  return { remaining: max, admitted: 0, rejected: 0, balls: [] }
}

/**
 * Streams an endless sequence of request balls at a fixed cadence for as long as this
 * scene's root node is reveal.js's current slide (mirrors `useEscalationOnPresence`, and
 * for the same reason: without it the stream would run unattended from page load). The
 * first `admitCount` balls ever spawned are admitted and burn `cost` tokens each; every
 * ball after that is rejected — the budget never refills mid-demo. Each ball's outcome
 * (and the token/scoreboard counters it drives) resolves exactly `travelMs` after it
 * spawns, in lockstep with it visually reaching the server and disappearing.
 */
export function useTokenAttackStream(
  enabled: boolean,
  config: TokenAttackConfig,
): TokenAttackState & { ref: (node: HTMLDivElement | null) => void } {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<TokenAttackState>(() => initialAttackState(config.max))

  useEffect(() => {
    if (!enabled) {
      return
    }

    let pollFrame = 0
    let spawnInterval: number | undefined
    const arrivalTimers = new Set<number>()
    let wasPresent = false
    let nextId = 0

    function stop(): void {
      window.clearInterval(spawnInterval)
      spawnInterval = undefined
      arrivalTimers.forEach((timer) => window.clearTimeout(timer))
      arrivalTimers.clear()
      nextId = 0
      setState(initialAttackState(config.max))
    }

    function spawnBall(): void {
      nextId += 1
      const id = nextId
      const admitted = id <= config.admitCount
      setState((s) => ({ ...s, balls: [...s.balls, { id, admitted }] }))

      const timer = window.setTimeout(() => {
        arrivalTimers.delete(timer)
        setState((s) => ({
          remaining: admitted ? Math.max(0, s.remaining - config.cost) : s.remaining,
          admitted: admitted ? s.admitted + 1 : s.admitted,
          rejected: admitted ? s.rejected : s.rejected + 1,
          balls: s.balls.filter((b) => b.id !== id),
        }))
      }, config.travelMs)
      arrivalTimers.add(timer)
    }

    function start(): void {
      setState(initialAttackState(config.max))
      spawnBall()
      spawnInterval = window.setInterval(spawnBall, config.intervalMs)
    }

    function poll(): void {
      const present = nodeRef.current?.closest('section')?.classList.contains('present') ?? false
      if (present && !wasPresent) {
        start()
      } else if (!present && wasPresent) {
        stop()
      }
      wasPresent = present
      pollFrame = requestAnimationFrame(poll)
    }
    pollFrame = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(pollFrame)
      stop()
    }
  }, [enabled, config.max, config.cost, config.admitCount, config.intervalMs, config.travelMs])

  const ref = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
  }, [])

  return { ...state, ref }
}

/**
 * Plays one non-repeating wave — instead of an endless stream — each time this
 * scene's root node becomes reveal.js's current slide: `wave` increments on every
 * arrival (bump it into a `replayKey` to force the wave's pulses to remount and
 * replay), and `settled` flips true `totalMs` later, once the wave has fully landed,
 * for revealing whatever final outcome it produced. Resets on leaving so the next
 * arrival gets a fresh run instead of an already-settled slide.
 */
export function useOneShotWave(enabled: boolean, totalMs: number): { ref: (node: HTMLDivElement | null) => void; wave: number; settled: boolean } {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [wave, setWave] = useState(0)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let pollFrame = 0
    let settleTimer: number | undefined
    let wasPresent = false

    function start(): void {
      window.clearTimeout(settleTimer)
      setSettled(false)
      setWave((w) => w + 1)
      settleTimer = window.setTimeout(() => setSettled(true), totalMs)
    }

    function stop(): void {
      window.clearTimeout(settleTimer)
      settleTimer = undefined
      setSettled(false)
    }

    function poll(): void {
      const present = nodeRef.current?.closest('section')?.classList.contains('present') ?? false
      if (present && !wasPresent) {
        start()
      } else if (!present && wasPresent) {
        stop()
      }
      wasPresent = present
      pollFrame = requestAnimationFrame(poll)
    }
    pollFrame = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(pollFrame)
      window.clearTimeout(settleTimer)
    }
  }, [enabled, totalMs])

  const ref = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
  }, [])

  return { ref, wave, settled }
}

/**
 * Escalates a level (1..maxLevel) at a fixed cadence for as long as this scene's
 * root node is reveal.js's current slide, resetting to 0 the moment it isn't —
 * so "gets worse each hit" restarts fresh every time a presenter actually arrives
 * on the slide, instead of running (and maxing out) unattended in the background
 * from page load, the way every slide in this deck is otherwise mounted.
 */
export function useEscalationOnPresence(
  enabled: boolean,
  stepMs: number,
  maxLevel: number,
): { ref: (node: HTMLDivElement | null) => void; level: number } {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let frame = 0
    let intervalId: number | undefined
    let wasPresent = false

    function stopEscalating(): void {
      window.clearInterval(intervalId)
      intervalId = undefined
      setLevel(0)
    }

    function startEscalating(): void {
      let current = 0
      setLevel(current)
      intervalId = window.setInterval(() => {
        current = Math.min(current + 1, maxLevel)
        setLevel(current)
        if (current >= maxLevel) {
          window.clearInterval(intervalId)
        }
      }, stepMs)
    }

    function poll(): void {
      const present = nodeRef.current?.closest('section')?.classList.contains('present') ?? false
      if (present && !wasPresent) {
        startEscalating()
      } else if (!present && wasPresent) {
        stopEscalating()
      }
      wasPresent = present
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(intervalId)
    }
  }, [enabled, stepMs, maxLevel])

  const ref = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
  }, [])

  return { ref, level }
}

// Round 2 (window boundary): the legit row streams calmly, while both herd rows
// each fire a burst right before AND right after every other boundary, with one
// full idle window in between (that idle window is structural, not pacing — the
// exploit needs each attacking window to have a fresh, unshared budget; see
// useBoundaryDoubleBurst). Fixed window admits the after-boundary wave in full (the
// 2x spike); sliding window's rolling lookback rejects it.
export function BoundaryAlgorithmView({ phase }: { phase: 'fixed-window' | 'sliding-window' }) {
  const burstHandlers = [
    useBoundaryDoubleBurst(BOUNDARY_DEMO_WINDOW_MS, LEGIT_LIMIT),
    useBoundaryDoubleBurst(BOUNDARY_DEMO_WINDOW_MS, LEGIT_LIMIT),
    useBoundaryDoubleBurst(BOUNDARY_DEMO_WINDOW_MS, LEGIT_LIMIT),
  ]

  return (
    <div className="identity-row-list identity-row-list--arena" style={{ width: '100%' }}>
      <div className="identity-row identity-row--legit">
        <span className="identity-row-label">legit user</span>
        <AlgorithmVisualization
          key={`legit-${phase}`}
          className="identity-row-canvas"
          algorithm={phase}
          limit={LEGIT_LIMIT}
          windowMs={BOUNDARY_DEMO_WINDOW_MS}
          height={80}
          autoPlay={false}
          hideControls
          showBoundaryLabels={false}
          onControllerReady={burstHandlers[0]}
        />
      </div>
      {HERD_LABELS.map((label, i) => (
        <div
          key={label}
          className={`identity-row${i === HERD_LABELS.length - 1 ? ' identity-row--more' : ''}`}
          style={{ '--hue': i * 65 } as CSSProperties}
        >
          <span className="identity-row-label">{label}</span>
          <AlgorithmVisualization
            key={`${label}-${phase}`}
            className="identity-row-canvas"
            algorithm={phase}
            limit={LEGIT_LIMIT}
            windowMs={BOUNDARY_DEMO_WINDOW_MS}
            height={80}
            autoPlay={false}
            hideControls
            showBoundaryLabels={false}
            onControllerReady={burstHandlers[i + 1]}
          />
        </div>
      ))}
    </div>
  )
}

export type LogBallConfig = {
  /** Gap between one ball spawning and the next. */
  intervalMs: number
  /** Time from a ball spawning to it landing and logging its value. */
  travelMs: number
  /** Values a landed ball logs, cycled through in order (looping) as balls keep landing. */
  values: string[]
  /** How many log lines to keep around — older ones fall off the top. */
  maxEntries: number
}

export type LogBall = { id: number }
export type LogEntry = { id: number; value: string }

type LogStreamState = { balls: LogBall[]; entries: LogEntry[] }

/**
 * Streams an endless sequence of balls at a fixed cadence for as long as this scene's
 * root node is reveal.js's current slide (mirrors `useEscalationOnPresence`/
 * `useTokenAttackStream`) — each one logs the next value from `values` (looping) the
 * moment it lands, `travelMs` after it spawned.
 */
export function useBallLogStream(
  enabled: boolean,
  config: LogBallConfig,
): LogStreamState & { ref: (node: HTMLDivElement | null) => void } {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<LogStreamState>({ balls: [], entries: [] })

  useEffect(() => {
    if (!enabled) {
      return
    }

    let pollFrame = 0
    let spawnInterval: number | undefined
    const landingTimers = new Set<number>()
    let wasPresent = false
    let nextId = 0

    function stop(): void {
      window.clearInterval(spawnInterval)
      spawnInterval = undefined
      landingTimers.forEach((timer) => window.clearTimeout(timer))
      landingTimers.clear()
      nextId = 0
      setState({ balls: [], entries: [] })
    }

    function spawnBall(): void {
      nextId += 1
      const id = nextId
      setState((s) => ({ ...s, balls: [...s.balls, { id }] }))

      const timer = window.setTimeout(() => {
        landingTimers.delete(timer)
        const value = config.values[(id - 1) % config.values.length]
        setState((s) => ({
          balls: s.balls.filter((b) => b.id !== id),
          entries: [...s.entries, { id, value }].slice(-config.maxEntries),
        }))
      }, config.travelMs)
      landingTimers.add(timer)
    }

    function start(): void {
      setState({ balls: [], entries: [] })
      spawnBall()
      spawnInterval = window.setInterval(spawnBall, config.intervalMs)
    }

    function poll(): void {
      const present = nodeRef.current?.closest('section')?.classList.contains('present') ?? false
      if (present && !wasPresent) {
        start()
      } else if (!present && wasPresent) {
        stop()
      }
      wasPresent = present
      pollFrame = requestAnimationFrame(poll)
    }
    pollFrame = requestAnimationFrame(poll)

    return () => {
      cancelAnimationFrame(pollFrame)
      stop()
    }
  }, [enabled, config.intervalMs, config.travelMs, config.values, config.maxEntries])

  const ref = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node
  }, [])

  return { ...state, ref }
}
