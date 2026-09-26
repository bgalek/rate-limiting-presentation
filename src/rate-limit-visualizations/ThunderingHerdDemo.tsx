import { useEffect, useRef, useState, type CSSProperties } from 'react'

const CLIENTS = [
  { name: 'client A', color: '#43d7e8' },
  { name: 'client B', color: '#7c8cff' },
  { name: 'client C', color: '#a9e34b' },
  { name: 'client D', color: '#ff922b' },
]

const LIMIT_PER_CLIENT = 4
const WINDOW_MS = 8_000
const WINDOW_SECONDS = WINDOW_MS / 1_000
const REQUEST_INTERVAL_MS = 1_000
const REQUESTS_PER_WINDOW = WINDOW_MS / REQUEST_INTERVAL_MS
const WINDOW_COUNT = 4
const DEMO_DURATION_MS = WINDOW_MS * WINDOW_COUNT + 2_200
const LOAD_BUCKET_MS = 1_000
// How long a just-fired retry burst stays visually "active" — shared by the timeline
// dot's highlight and the Retry-After header flash so the two stay in lockstep.
const RETRY_HIGHLIGHT_MS = 260
const CHART_DURATION_MS = WINDOW_MS * WINDOW_COUNT + LOAD_BUCKET_MS
// Keep the simulated clock on a fixed-window boundary so the epoch reset value
// and the boundary drawn in the timeline always refer to the same instant.
const SIMULATION_START_EPOCH_SECONDS = 1_700_000_000 - (1_700_000_000 % WINDOW_SECONDS)

interface RequestEvent {
  time: number
  kind: 'initial' | 'retry'
  allowed: boolean
  count?: number
  windowIndex: number
  remaining: number
}

type DemoPhase = 'idle' | 'running' | 'paused' | 'complete'

function eventsForClient(clientIndex: number): RequestEvent[] {
  const events: RequestEvent[] = []
  let queuedRequests = 0

  for (let windowIndex = 0; windowIndex < WINDOW_COUNT; windowIndex += 1) {
    const windowStart = windowIndex * WINDOW_MS
    let remaining = LIMIT_PER_CLIENT

    if (windowIndex > 0) {
      const retryCount = queuedRequests
      events.push({
        time: windowStart,
        kind: 'retry',
        allowed: retryCount <= LIMIT_PER_CLIENT,
        count: retryCount,
        windowIndex,
        remaining: Math.max(LIMIT_PER_CLIENT - retryCount, 0),
      })
      queuedRequests = Math.max(retryCount - LIMIT_PER_CLIENT, 0)
      remaining = Math.max(LIMIT_PER_CLIENT - Math.min(retryCount, LIMIT_PER_CLIENT), 0)
    }

    for (let requestIndex = 0; requestIndex < REQUESTS_PER_WINDOW; requestIndex += 1) {
      const allowed = remaining > 0
      events.push({
        // Clients arrive at a sustained one-request-per-second rate but share one fixed-window boundary.
        time: windowStart + 250 + requestIndex * REQUEST_INTERVAL_MS + clientIndex * 100,
        kind: 'initial',
        allowed,
        windowIndex,
        remaining: Math.max(remaining - 1, 0),
      })
      if (allowed) {
        remaining -= 1
      } else {
        queuedRequests += 1
      }
    }
  }

  if (queuedRequests > 0) {
    events.push({
      time: WINDOW_COUNT * WINDOW_MS,
      kind: 'retry',
      allowed: queuedRequests <= LIMIT_PER_CLIENT,
      count: queuedRequests,
      windowIndex: WINDOW_COUNT,
      remaining: Math.max(LIMIT_PER_CLIENT - queuedRequests, 0),
    })
  }

  return events.sort((left, right) => left.time - right.time)
}

function allEvents(): RequestEvent[] {
  return CLIENTS.flatMap((_, clientIndex) => eventsForClient(clientIndex))
}

function eventPosition(time: number, elapsed: number): number {
  return 50 + ((time - elapsed) / WINDOW_MS) * 50
}

function isVisible(event: RequestEvent, elapsed: number, started: boolean): boolean {
  const age = elapsed - event.time
  return started && age >= 0 && age <= WINDOW_MS
}

function formatClock(epochSeconds: number): string {
  return `${new Date(epochSeconds * 1_000).toISOString().slice(11, 19)} UTC`
}

function loadForBucket(bucketIndex: number): number {
  const start = bucketIndex * LOAD_BUCKET_MS
  const end = start + LOAD_BUCKET_MS
  let load = 0

  for (const event of allEvents()) {
    if (event.time >= start && event.time < end) {
      load += event.kind === 'retry' ? event.count ?? 0 : 1
    }
  }

  return load
}

export default function ThunderingHerdDemo() {
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)

  useEffect(
    function animateDemo() {
      if (phase !== 'running') {
        return
      }

      let frame = 0
      startedAtRef.current = null

      function tick(now: number): void {
        if (startedAtRef.current === null) {
          startedAtRef.current = now
        }

        const nextElapsed = Math.min(
          elapsedRef.current + now - startedAtRef.current,
          DEMO_DURATION_MS,
        )
        startedAtRef.current = now
        elapsedRef.current = nextElapsed
        setElapsed(nextElapsed)

        if (nextElapsed >= DEMO_DURATION_MS) {
          setPhase('complete')
          return
        }

        frame = window.requestAnimationFrame(tick)
      }

      frame = window.requestAnimationFrame(tick)
      return () => window.cancelAnimationFrame(frame)
    },
    [phase],
  )

  function run(): void {
    startedAtRef.current = null
    elapsedRef.current = 0
    setElapsed(0)
    setPhase('running')
  }

  function togglePause(): void {
    if (phase === 'running') {
      setPhase('paused')
    } else if (phase === 'paused') {
      setPhase('running')
    }
  }

  function reset(): void {
    startedAtRef.current = null
    elapsedRef.current = 0
    setElapsed(0)
    setPhase('idle')
  }

  const started = phase !== 'idle'
  const progress = Math.min(elapsed / DEMO_DURATION_MS, 1) * 100
  const currentEpochSeconds = SIMULATION_START_EPOCH_SECONDS + Math.floor(elapsed / 1_000)
  const clientHeaderEvents = eventsForClient(0).filter((event) => event.time <= elapsed)
  const latestHeaderEvent = clientHeaderEvents.at(-1)
  const headerBlocked = latestHeaderEvent?.allowed === false
  const headerWindowIndex = latestHeaderEvent?.windowIndex ?? 0
  const resetBoundaryIndex = headerWindowIndex + 1
  const resetEpochSeconds = SIMULATION_START_EPOCH_SECONDS + resetBoundaryIndex * WINDOW_SECONDS
  const resetBoundaryTime = resetBoundaryIndex * WINDOW_MS
  const retrySeconds = headerBlocked
    ? Math.max(0, Math.ceil(resetEpochSeconds - currentEpochSeconds))
    : 0
  const headerRemaining = latestHeaderEvent?.remaining ?? LIMIT_PER_CLIENT
  const headerRetryFlash =
    latestHeaderEvent?.kind === 'retry' && elapsed - latestHeaderEvent.time < RETRY_HIGHLIGHT_MS
  const chartBucketCount = Math.ceil(CHART_DURATION_MS / LOAD_BUCKET_MS)
  const chartLoads = Array.from({ length: chartBucketCount }, (_, index) => loadForBucket(index))
  const maxChartLoad = Math.max(...chartLoads, 1)

  return (
    <div className="herd-demo">
      <div className="herd-demo__timeline" aria-label="Client request timeline">
        <div className="herd-demo__axis" aria-hidden="true">
          <span className="herd-demo__progress" style={{ width: `${progress}%` }} />
        </div>

        <div className="herd-demo__lanes">
            {CLIENTS.map((client, clientIndex) => {
              const events = eventsForClient(clientIndex)

              return (
                <div className="herd-demo__lane" key={client.name}>
                  <span className="herd-demo__client" style={{ '--client-color': client.color } as CSSProperties}>
                    {client.name}
                  </span>
                  <div className="herd-demo__track">
                    {Array.from({ length: WINDOW_COUNT + 2 }, (_, index) => index * WINDOW_MS).map((time) => {
                      const left = eventPosition(time, elapsed)
                      const visible = left >= -4 && left <= 104

                      return visible ? (
                        <span
                          className={`herd-demo__track-boundary ${time === resetBoundaryTime ? 'herd-demo__track-boundary--next' : ''}`}
                          key={time}
                          style={{ left: `${left}%` }}
                        />
                      ) : null
                    })}
                    <span className="herd-demo__now-line" />
                    {events.map((event) => {
                      const visible = isVisible(event, elapsed, started)
                      const active = visible && elapsed - event.time < RETRY_HIGHLIGHT_MS
                      const left = eventPosition(event.time, elapsed)
                      const retryTotal = event.count ?? 0
                      const retryAdmitted = Math.min(retryTotal, LIMIT_PER_CLIENT)
                      const retryRequeued = retryTotal - retryAdmitted
                      const retryTitle =
                        retryRequeued > 0
                          ? `${retryTotal} queued requests retried together · ${retryAdmitted} admitted, ${retryRequeued} re-queued for the next boundary`
                          : `${retryTotal} queued requests retried together · all ${retryAdmitted} admitted`

                      return (
                        <span
                          className={`herd-demo__event ${event.allowed ? 'herd-demo__event--allowed' : 'herd-demo__event--blocked'} ${event.kind === 'retry' ? 'herd-demo__event--retry' : ''} ${visible ? '' : 'herd-demo__event--hidden'} ${active ? 'herd-demo__event--active' : ''}`}
                          key={`${event.kind}-${event.time}`}
                          style={{ left: `${left}%` }}
                          title={event.kind === 'retry' ? retryTitle : event.allowed ? '200 OK' : `429 · retry at the ${WINDOW_MS / 1_000}s window boundary`}
                        >
                          {event.kind === 'retry'
                            ? Array.from({ length: retryTotal }, (_, index) => (
                                <i
                                  className="herd-demo__retry-ball"
                                  key={index}
                                  style={{ '--retry-offset': `${index * 2}px` } as CSSProperties}
                                />
                              ))
                            : null}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="herd-demo__legend">
            <span><i className="herd-demo__legend-dot herd-demo__legend-dot--allowed" /> allowed</span>
            <span><i className="herd-demo__legend-dot herd-demo__legend-dot--blocked" /> rejected</span>
            <span><i className="herd-demo__legend-dot herd-demo__legend-dot--retry" /> queued retries</span>

            <div className="demo-actions herd-demo__controls">
              <button type="button" className="button-danger" onClick={run} disabled={phase === 'running' || phase === 'paused'}>
                {phase === 'complete' ? 'Replay' : 'Start'}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={togglePause}
                disabled={phase === 'idle' || phase === 'complete'}
              >
                {phase === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button type="button" className="button-secondary" onClick={reset}>Reset</button>
            </div>
          </div>
      </div>

      <div className="herd-demo__bottom-row">
        <div className="herd-demo__corner herd-demo__corner--left">
          <div className="herd-demo__clock">
            <span>clock</span>
            <strong>{formatClock(currentEpochSeconds)}</strong>
            <small>{currentEpochSeconds}</small>
          </div>
          <div className="response-headers herd-demo__headers">
            <div className="response-headers__status" data-blocked={headerBlocked || undefined}>
              {headerBlocked ? '429 Too Many Requests' : '200 OK'}
            </div>
            <div className="response-headers__row"><span>X-RateLimit-Limit</span><strong>{LIMIT_PER_CLIENT}</strong></div>
            <div className="response-headers__row"><span>X-RateLimit-Remaining</span><strong>{headerRemaining}</strong></div>
            <div className="response-headers__row"><span>X-RateLimit-Reset</span><strong className="herd-demo__reset-value">{resetEpochSeconds}<small>({formatClock(resetEpochSeconds)})</small></strong></div>
            <div
              className="response-headers__row response-headers__row--retry"
              data-active={headerBlocked || undefined}
              data-flash={headerRetryFlash || undefined}
            >
              <span>Retry-After</span>
              <strong>{headerBlocked ? `${retrySeconds}s` : '—'}</strong>
            </div>
          </div>
        </div>

        <div className="herd-demo__corner herd-demo__corner--right">
          <div className="herd-demo__service">
            <div className="herd-demo__load-chart" aria-label="Total requests received in each one-second interval">
              {Array.from({ length: chartBucketCount }, (_, index) => {
                const count = chartLoads[index]
                const bucketTime = index * LOAD_BUCKET_MS
                const revealed = started && bucketTime <= elapsed

                return (
                  <span
                    className={`herd-demo__load-bar ${count >= LIMIT_PER_CLIENT * CLIENTS.length ? 'herd-demo__load-bar--spike' : ''} ${revealed ? '' : 'herd-demo__load-bar--hidden'}`}
                    key={bucketTime}
                    style={{ height: `${count === 0 ? 0 : Math.max((count / maxChartLoad) * 100, 5)}%` }}
                    title={`${count} requests in this ${LOAD_BUCKET_MS}ms slice`}
                  >
                    <strong>{count}</strong>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
