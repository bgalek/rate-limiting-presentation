import { Deck, Slide } from '@revealjs/react'
import {
  IconActivity, IconAlertTriangle, IconApi, IconArrowRight, IconBolt,
  IconBrandCloudflare, IconBrandGithub, IconBrandReddit,
  IconCoin, IconCpu, IconDatabase,
  IconLock, IconNetwork,
  IconServer, IconShield, IconStack2, IconTarget, IconUsers, IconWifi,
} from '@tabler/icons-react'
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import 'reveal.js/reveal.css'
import {
  AlgorithmVisualization,
  FixedWindowVisualization,
  FloatingWindowVisualization,
  LeakyBucketVisualization,
  ResponseHeaders,
  SlidingWindowVisualization,
  TokenBucketVisualization,
  type AlgorithmVisualizationProps,
  type VisualizationController,
  type VisualizationSnapshot,
} from './rate-limit-visualizations'

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

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>
}

function RoleLine({ children, role }: { children: ReactNode; role: 'bad' | 'good' }) {
  return (
    <div className={`role-line role-line--${role}`}>
      <span>{role === 'good' ? 'Good cop' : 'Bad cop'}</span>
      <p>{children}</p>
    </div>
  )
}

function Metric({ label, tone = 'cyan', value }: { label: string; tone?: 'cyan' | 'yellow'; value: string }) {
  return <div className={`metric metric--${tone}`}><span>{label}</span><strong>{value}</strong></div>
}

type AlgorithmDemoVisualizationProps = Omit<AlgorithmVisualizationProps, 'algorithm'>

function AlgorithmDemo({
  component: Visualization,
  legend,
  ...visualizationProps
}: AlgorithmDemoVisualizationProps & {
  component: ComponentType<AlgorithmDemoVisualizationProps>
  legend?: ReactNode
}) {
  const [snapshot, setSnapshot] = useState<VisualizationSnapshot | null>(null)

  return (
    <div className="algorithm-stage">
      <div className="live-canvas algorithm-stage__canvas">
        <Visualization {...visualizationProps} onSnapshot={setSnapshot} />
        {legend}
      </div>
      <ResponseHeaders snapshot={snapshot} />
    </div>
  )
}

function FloatingWindowFormula() {
  const LIMIT = 6
  const [snapshot, setSnapshot] = useState<VisualizationSnapshot | null>(null)
  const floatingWindow = snapshot?.floatingWindow

  return (
    <>
      <div className="formula formula--annotated">
        <div className="formula-equation">
          <span className="formula-unit">
            <span className="formula-term formula-term--estimate">estimated requests</span>
            <span className="formula-value">{floatingWindow ? floatingWindow.estimate.toFixed(2) : '—'}</span>
          </span>
          <span className="formula-op">=</span>
          <span className="formula-unit">
            <span className="formula-term formula-term--previous">previous window's requests</span>
            <span className="formula-value">{floatingWindow ? floatingWindow.previousWindowCount : '—'}</span>
          </span>
          <span className="formula-op">×</span>
          <span className="formula-unit">
            <span className="formula-term formula-term--weight">% of it that carries over</span>
            <span className="formula-value">{floatingWindow ? `${(floatingWindow.previousWindowWeight * 100).toFixed(0)}%` : '—'}</span>
          </span>
          <span className="formula-op">+</span>
          <span className="formula-unit">
            <span className="formula-term formula-term--current">this window's requests so far</span>
            <span className="formula-value">{floatingWindow ? floatingWindow.currentWindowCount : '—'}</span>
          </span>
        </div>
        <span className="formula-arrow" aria-hidden="true">
          <span className="formula-arrow-line" />
          <span className="formula-arrow-head" />
        </span>
        <span className="formula-unit">
          <span className="formula-term formula-term--remaining">remaining limit</span>
          <span className="formula-value">{snapshot ? `${snapshot.remaining.toFixed(1)} / ${LIMIT}` : '—'}</span>
        </span>
      </div>
      <div className="algorithm-stage">
        <div className="live-canvas algorithm-stage__canvas">
          <FloatingWindowVisualization limit={LIMIT} height={196} onSnapshot={setSnapshot} />
        </div>
        <ResponseHeaders snapshot={snapshot} />
      </div>
    </>
  )
}

function ScenarioState({ step, control, event }: { step: string; control: string; event: string }) {
  return (
    <div className="scenario-state">
      <span>{step}</span>
      <strong>{control}</strong>
      <em>{event}</em>
    </div>
  )
}

const BOTNET_IPS = [
  '198.51.100.23', '203.0.113.87', '192.0.2.14', '198.51.100.201',
]
const VISIBLE_BOTNET_IPS = BOTNET_IPS.slice(0, 3)

function IdentityDemo() {
  const [state, setState] = useState<'idle' | 'attack' | 'fixed'>('idle')
  const [revealedRows, setRevealedRows] = useState(0)
  const [gauge, setGauge] = useState(2)
  const [attempted, setAttempted] = useState(0)
  const [admitted, setAdmitted] = useState(0)

  useEffect(function driveAttackReveal() {
    if (state === 'idle') {
      setRevealedRows(1)
      setGauge(2)
      setAttempted(0)
      setAdmitted(0)
      return
    }
    if (state === 'fixed') {
      setRevealedRows(VISIBLE_BOTNET_IPS.length)
      setGauge(18)
      setAttempted(10_000)
      setAdmitted(100)
      return
    }
    setRevealedRows(1)
    setGauge(2)
    setAttempted(0)
    setAdmitted(0)
    let count = 1
    const id = window.setInterval(() => {
      count += 1
      setRevealedRows(count)
      setGauge(Math.round((count / VISIBLE_BOTNET_IPS.length) * 100))
      const nextAttempted = Math.min(10_000, Math.round((count / VISIBLE_BOTNET_IPS.length) * 10_000))
      setAttempted(nextAttempted)
      setAdmitted(nextAttempted)
      if (count >= VISIBLE_BOTNET_IPS.length) {
        window.clearInterval(id)
      }
    }, 320)
    return () => window.clearInterval(id)
  }, [state])

  const attackerLimit = state === 'fixed' ? 1 : 6
  const metrics = state === 'idle'
    ? { admitted: '—', blocked: '—' }
    : { admitted: admitted.toLocaleString(), blocked: Math.max(0, attempted - admitted).toLocaleString() }

  return (
    <div className="identity-demo-v3">
      <ScenarioState
        step="01 · same attack"
        control={state === 'fixed' ? 'API key / JWT subject · 100 req/min' : 'source IP · 100 req/min'}
        event={state === 'fixed' ? '10,000 IPs collapse into one budget' : 'rotating proxies spread the budget across 10,000 identities'}
      />
      <div className="limiter-config">
        <span>Limiter</span>
        <strong>{state === 'fixed' ? 'API key / JWT subject' : 'source IP address'}</strong>
        <em>fixed window</em>
      </div>

      <div className="identity-stage-v3">
        <div className="identity-row-list">
          <div className="identity-row identity-row--legit">
            <span className="identity-row-label">legit user · 203.0.113.7</span>
            <FixedWindowVisualization
              className="identity-row-canvas"
              limit={6}
              windowMs={6_000}
              height={46}
              steadyMode
              hideControls
              showBoundaryLabels={false}
            />
          </div>

          {VISIBLE_BOTNET_IPS.slice(0, revealedRows).map((ip, i) => (
            <div key={ip} className="identity-row" style={{ '--hue': i * 65 } as CSSProperties}>
              <span className="identity-row-label">{ip}</span>
              <FixedWindowVisualization
                className="identity-row-canvas"
                limit={attackerLimit}
                windowMs={6_000}
                height={46}
                steadyMode
                hideControls
                showBoundaryLabels={false}
              />
            </div>
          ))}

          {revealedRows > 0 && <div className="botnet-more">+9,997 more IPs</div>}
        </div>

        <div className={state === 'attack' ? 'cpu-gauge cpu-gauge--hot cpu-gauge--flicker' : 'cpu-gauge'}>
          <IconServer />
          <strong>{gauge}%</strong>
          <span>server load</span>
        </div>
      </div>

      <div className="metric-row scenario-metrics">
        <Metric label="requests admitted" value={metrics.admitted} />
        <Metric label="requests rejected" tone="yellow" value={metrics.blocked} />
      </div>

      <div className="demo-actions">
        <button type="button" className="button-danger" onClick={() => setState('attack')}>Rotate 10,000 IPs</button>
        <button type="button" onClick={() => setState('fixed')}>Key the identity</button>
        <button type="button" className="button-secondary" onClick={() => setState('idle')}>Reset</button>
      </div>
    </div>
  )
}

function OverloadCostDemo() {
  const [state, setState] = useState<'idle' | 'breaker' | 'costBased'>('idle')
  const clients: { id: string; attacker: boolean }[] = [
    { id: 'a', attacker: false },
    { id: 'b', attacker: false },
    { id: 'c', attacker: false },
    { id: 'x', attacker: true },
  ]

  function statusFor(attacker: boolean): { cls: string; label: string } {
    if (state === 'idle') return { cls: 'cost-chip', label: '—' }
    if (state === 'breaker') return { cls: 'cost-chip cost-chip--blocked', label: '503' }
    if (attacker) return { cls: 'cost-chip cost-chip--blocked', label: '429' }
    return { cls: 'cost-chip cost-chip--pass', label: '200' }
  }

  const metrics = state === 'idle'
    ? { exportStatus: '200', db: '12%', attacker: '10 / min' }
    : state === 'breaker'
      ? { exportStatus: '503', db: '97%', attacker: '10 / min' }
      : { exportStatus: '200', db: '14%', attacker: '2 × 50 tokens' }

  return (
    <div className="cost-demo">
      <ScenarioState
        step="03 · same API key"
        control={state === 'costBased' ? 'weighted budget · /ping 1 · /export 50' : state === 'breaker' ? 'circuit breaker · /export open' : 'sliding window · 100 req/min'}
        event={state === 'costBased' ? 'the expensive endpoint is rejected before it reaches the database' : state === 'breaker' ? 'the database survives; legitimate /export users receive 503 too' : 'the bot stays under the volume limit and aims every request at /export'}
      />
      <div className="cost-chips" aria-hidden="true">
        {clients.map((client) => {
          const { cls, label } = statusFor(client.attacker)
          return (
            <div key={client.id} className={cls}>
              <div className="chip-icon">{client.attacker ? <IconBolt /> : <IconUsers />}</div>
              <span className="chip-status">{label}</span>
            </div>
          )
        })}
      </div>
      <div className={state === 'breaker' ? 'cpu-gauge cpu-gauge--hot' : 'cpu-gauge'}>
        <IconDatabase />
        <strong>{state === 'breaker' ? '97%' : state === 'costBased' ? '14%' : '12%'}</strong>
        <span>database load</span>
      </div>
      <div className="metric-row scenario-metrics">
        <Metric label="/export response" tone={state === 'breaker' ? 'yellow' : 'cyan'} value={metrics.exportStatus} />
        <Metric label="attacker traffic" tone={state === 'costBased' ? 'yellow' : 'cyan'} value={metrics.attacker} />
        <Metric label="database load" tone={state === 'breaker' ? 'yellow' : 'cyan'} value={metrics.db} />
      </div>
      <div className="demo-actions">
        <button type="button" className="button-danger" onClick={() => setState('breaker')}>Flood /export</button>
        <button type="button" onClick={() => setState('costBased')}>Price by cost</button>
        <button type="button" className="button-secondary" onClick={() => setState('idle')}>Reset</button>
      </div>
    </div>
  )
}

const HERD_WAVES = [VISIBLE_BOTNET_IPS[0], 'bad user 02 · 11:59:59', 'bad user 03 · 12:00:01']

function WindowBoundaryDemo() {
  const WINDOW_MS = 2_000
  const LIMIT = 6
  type Phase = 'identity' | 'herd-fixed' | 'sliding'
  const [phase, setPhase] = useState<Phase>('identity')
  const [revealPhase, setRevealPhase] = useState<'idle' | 'revealing' | 'revealed'>('idle')
  const [revealedRows, setRevealedRows] = useState(1)
  const [gauge, setGauge] = useState(18)
  const boundaryRef = useRef<number | null>(null)
  const herdControllersRef = useRef<Record<number, VisualizationController | null>>({})
  const decayIntervalRef = useRef<number | null>(null)
  const timeoutsRef = useRef<number[]>([])
  const burstIntervalsRef = useRef<number[]>([])

  const showingIdentity = phase === 'identity'
  const sliding = phase === 'sliding'
  const visualWindowMs = showingIdentity ? 6_000 : WINDOW_MS

  function clearScheduledWork(): void {
    if (decayIntervalRef.current !== null) {
      window.clearInterval(decayIntervalRef.current)
      decayIntervalRef.current = null
    }
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []
    burstIntervalsRef.current.forEach((id) => window.clearInterval(id))
    burstIntervalsRef.current = []
  }

  useEffect(function cleanupTimers() {
    return clearScheduledWork
  }, [])

  function fireBurstOn(controller: VisualizationController | null, targetTime: number): void {
    if (controller === null) return
    const activeController = controller

    function burstOnce(): void {
      let count = 0
      const id = window.setInterval(() => {
        activeController.hit()
        count += 1
        if (count >= 10) {
          window.clearInterval(id)
          burstIntervalsRef.current = burstIntervalsRef.current.filter((activeId) => activeId !== id)
        }
      }, 24)
      burstIntervalsRef.current.push(id)
    }

    const offsets = [-220, 220, WINDOW_MS - 220, WINDOW_MS + 220, WINDOW_MS * 2 - 220, WINDOW_MS * 2 + 220]
    offsets.forEach((offset) => {
      const delay = Math.max(0, targetTime + offset - performance.now())
      timeoutsRef.current.push(window.setTimeout(burstOnce, delay))
    })
  }

  function attachHerdController(index: number) {
    return (controller: VisualizationController | null) => {
      herdControllersRef.current[index] = controller
      if (controller !== null && boundaryRef.current !== null) {
        fireBurstOn(controller, boundaryRef.current)
      }
    }
  }

  useEffect(function driveHerdReveal() {
    if (revealPhase !== 'revealing') {
      return
    }
    setRevealedRows(1)
    setGauge(2)
    boundaryRef.current = performance.now() + 650
    Object.values(herdControllersRef.current).forEach((controller) => {
      fireBurstOn(controller, boundaryRef.current as number)
    })
    let count = 1
    const id = window.setInterval(() => {
      count += 1
      setRevealedRows(count)
      setGauge(Math.round((count / HERD_WAVES.length) * 100))
      if (count >= HERD_WAVES.length) {
        window.clearInterval(id)
        setRevealPhase('revealed')
        const holdTimeout = window.setTimeout(() => {
          const start = performance.now()
          const decayId = window.setInterval(() => {
            const progress = Math.min(1, (performance.now() - start) / 1_600)
            const restTo = sliding ? 42 : 55
            setGauge(Math.round(100 + (restTo - 100) * progress))
            if (progress >= 1) window.clearInterval(decayId)
          }, 60)
          decayIntervalRef.current = decayId
        }, 500)
        timeoutsRef.current.push(holdTimeout)
      }
    }, 110)
    return () => window.clearInterval(id)
  }, [revealPhase, sliding])

  function runHerd(): void {
    clearScheduledWork()
    if (showingIdentity) {
      setPhase('herd-fixed')
      setRevealedRows(1)
      setRevealPhase('revealing')
      return
    }
    setRevealPhase('revealing')
  }

  function switchToSliding(): void {
    clearScheduledWork()
    setPhase('sliding')
    setRevealedRows(HERD_WAVES.length)
    setRevealPhase('revealed')
    boundaryRef.current = performance.now() + 350
    setGauge(42)
  }

  function reset(): void {
    clearScheduledWork()
    setPhase('identity')
    setRevealPhase('idle')
    setRevealedRows(1)
    setGauge(18)
  }

  function removeRotatingIps(): void {
    clearScheduledWork()
    setPhase('identity')
    setRevealPhase('idle')
    setRevealedRows(1)
    setGauge(18)
    herdControllersRef.current = { 0: herdControllersRef.current[0] ?? null }
    boundaryRef.current = null
  }

  const algorithm = sliding ? 'sliding-window' : 'fixed-window'
  const herdMetrics = showingIdentity
    ? { admitted: '100', rejected: '9,900' }
    : sliding
      ? { admitted: '100', rejected: '100' }
    : revealPhase === 'revealed'
      ? { admitted: '200', rejected: '0' }
      : { admitted: '—', rejected: '—' }

  return (
    <div className="identity-demo-v3">
      <ScenarioState
        step="02 · same API key"
        control={showingIdentity ? 'API key / JWT subject · 100 req/min' : sliding ? 'API key / JWT subject · sliding window · 100 req/min' : 'API key / JWT subject · fixed window · 100 req/min'}
        event={showingIdentity ? '10,000 IPs collapse into one budget' : sliding ? 'the window moves with the timestamps; the boundary spike is rejected' : 'the same actors keep firing rapidly just before and after every boundary'}
      />
      <div className="limiter-config">
        <span>Limiter</span>
        <strong>API key / JWT subject</strong>
        <em>{sliding ? 'sliding window' : 'fixed window'}</em>
      </div>

      <div className="identity-stage-v3">
        <div className="identity-row-list">
          <div className="identity-row identity-row--legit">
            <span className="identity-row-label">legit user · 203.0.113.7</span>
            <AlgorithmVisualization
              key={`legit-${algorithm}`}
              className="identity-row-canvas"
              algorithm={algorithm}
              limit={LIMIT}
              windowMs={visualWindowMs}
              height={46}
              steadyMode={showingIdentity}
              hideControls
              showBoundaryLabels={false}
            />
          </div>

          {(showingIdentity ? VISIBLE_BOTNET_IPS : HERD_WAVES).slice(0, revealedRows).map((label, i) => (
            <div key={label} className="identity-row" style={{ '--hue': i * 65 } as CSSProperties}>
              <span className="identity-row-label">{label}</span>
              <AlgorithmVisualization
                key={`${label}-${algorithm}`}
                className="identity-row-canvas"
                algorithm={algorithm}
                limit={showingIdentity ? 1 : LIMIT}
                windowMs={visualWindowMs}
                autoPlay={showingIdentity ? true : false}
                burstMode={!showingIdentity}
                steadyMode={showingIdentity}
                hideControls
                showBoundaryLabels={false}
                onControllerReady={attachHerdController(i)}
              />
            </div>
          ))}
          {showingIdentity && <div className="botnet-more">+9,997 more IPs</div>}
        </div>

        <div className={gauge > 70 ? 'cpu-gauge cpu-gauge--hot cpu-gauge--flicker' : 'cpu-gauge'}>
          <IconServer />
          <strong>{gauge}%</strong>
          <span>server load</span>
        </div>
      </div>

      <div className="metric-row scenario-metrics">
        <Metric label="requests admitted" value={herdMetrics.admitted} />
        <Metric label={sliding ? 'escapees rejected' : 'requests rejected'} tone="yellow" value={herdMetrics.rejected} />
      </div>

      <div className="demo-actions">
        <button type="button" className="button-danger" onClick={runHerd}>Run thundering herd</button>
        <button type="button" onClick={switchToSliding}>Switch to sliding window</button>
        <button type="button" onClick={removeRotatingIps}>Remove rotating IPs</button>
        <button type="button" className="button-secondary" onClick={reset}>Reset</button>
      </div>
    </div>
  )
}

function WeightedCostDemo() {
  const [remaining, setRemaining] = useState(100)
  const [lastResult, setLastResult] = useState('Budget ready')

  function spend(cost: number, endpoint: string): void {
    if (remaining < cost) {
      setLastResult(`429 · ${endpoint} needs ${cost} tokens`)
      return
    }
    setRemaining(remaining - cost)
    setLastResult(`200 · ${endpoint} spent ${cost}`)
  }

  function reset(): void {
    setRemaining(100)
    setLastResult('Budget ready')
  }

  return (
    <div className="weighted-demo">
      <div className="budget-orbit" style={{ '--remaining': `${remaining}%` } as CSSProperties}>
        <strong>{remaining}</strong><span>tokens left</span>
      </div>
      <div className="endpoint-actions">
        <button type="button" onClick={spend.bind(null, 1, '/ping')}><span>/ping</span><strong>1 token</strong></button>
        <button type="button" className="button-danger" onClick={spend.bind(null, 50, '/export')}><span>/export</span><strong>50 tokens</strong></button>
        <button type="button" className="button-secondary" onClick={reset}>Reset budget</button>
        <p aria-live="polite">{lastResult}</p>
      </div>
    </div>
  )
}

function AtomicityDemo() {
  const [result, setResult] = useState<'idle' | 'sequential' | 'racy' | 'atomic'>('idle')

  function runSequential(): void { setResult('sequential') }
  function runRacyBurst(): void { setResult('racy') }
  function runAtomicBurst(): void { setResult('atomic') }

  const metrics = result === 'idle'
    ? { successful: '—', rejected: '—', headers: '—' }
    : result === 'sequential'
      ? { successful: '100', rejected: '100', headers: 'in order' }
      : result === 'racy'
        ? { successful: '115', rejected: '85', headers: 'out of order' }
        : { successful: '100', rejected: '100', headers: 'in sync' }

  return (
    <div className="atomicity-demo">
      <ScenarioState
        step="04 · same 100-token budget"
        control={result === 'atomic' ? 'Redis Lua · atomic check + increment' : 'weighted limiter · distributed read → write'}
        event={result === 'racy' ? '200 concurrent requests expose the 5 ms check/update gap' : result === 'atomic' ? 'one operation, one authority, no overshoot' : 'sequential requests are the control experiment'}
      />
      <div className="edge-nodes" aria-hidden="true"><span>edge 01</span><span>edge 02</span><span>edge 03</span><span>edge 04</span></div>
      <IconArrowRight className="flow-arrow" />
      <div className={result === 'atomic' ? 'redis-core redis-core--atomic' : 'redis-core'}>
        <IconDatabase /><strong>Redis</strong><span>{result === 'atomic' ? 'EVAL' : 'GET → SET'}</span>
      </div>
      <div className="atomic-results">
        <div className="metric-row">
          <Metric label="successful" value={metrics.successful} />
          <Metric label="rejected" tone="yellow" value={metrics.rejected} />
        </div>
        <div className="atomic-header-metric"><span>X-RateLimit-Remaining</span><strong>{metrics.headers}</strong></div>
        <p>{result === 'racy' ? '15 heavy requests slipped through the check/update gap.' : result === 'atomic' ? 'The decision and update became one indivisible operation.' : 'The one-by-one control hits the limit exactly. Now change only the concurrency.'}</p>
        <div className="demo-actions">
          <button type="button" onClick={runSequential}>Run sequential test</button>
          <button type="button" className="button-danger" onClick={runRacyBurst}>Run read-then-write</button>
          <button type="button" onClick={runAtomicBurst}>Run atomic Lua</button>
        </div>
      </div>
    </div>
  )
}

function RedisMeltdownDemo() {
  const [state, setState] = useState<'idle' | 'loaded' | 'fixed'>('idle')

  return (
    <div className="meltdown-demo">
      <ScenarioState
        step="06 · same limiter"
        control={state === 'fixed' ? 'two-tier · local first, Redis every ~1s' : 'atomic Lua · every request asks Redis'}
        event={state === 'loaded' ? '100,000 requests/s now target the limiter, not the application' : state === 'fixed' ? 'most decisions leave Redis off the hot path' : 'perfect consistency still has a finite throughput ceiling'}
      />
      <div className={state === 'loaded' ? 'cpu-gauge cpu-gauge--hot' : 'cpu-gauge'}>
        <IconCpu />
        <strong>{state === 'loaded' ? '100%' : state === 'fixed' ? '9%' : '4%'}</strong>
        <span>Redis single-thread CPU</span>
      </div>
      <div className="meltdown-results">
        <div className="metric-row">
          <Metric label="load aimed at Redis" value={state === 'idle' ? '—' : '100k rps'} />
          <Metric label="rate limit accuracy" value={state === 'idle' ? '—' : state === 'fixed' ? 'eventual' : 'exact'} />
          <Metric label="service" tone={state === 'loaded' ? 'yellow' : 'cyan'} value={state === 'loaded' ? 'DOWN' : state === 'fixed' ? 'UP' : 'up'} />
        </div>
        <div className="demo-actions">
          <button type="button" className="button-danger" onClick={() => setState('loaded')}>Run 100k rps load test</button>
          <button type="button" onClick={() => setState('fixed')}>Switch to two-tier</button>
          <button type="button" className="button-secondary" onClick={() => setState('idle')}>Reset</button>
        </div>
      </div>
    </div>
  )
}

function TwoTierDemo() {
  const [synced, setSynced] = useState(false)

  function runOverBudget(): void { setSynced(true) }
  function reset(): void { setSynced(false) }

  return (
    <div className="twotier-demo">
      <ScenarioState step="07 · same 100 req/min policy" control="two-tier · local counters + async global sync" event={synced ? '105 admitted is acceptable; the application and database stay alive' : 'move the fast path local, then reconcile the shared budget in the background'} />
      <div className="tier-nodes" aria-hidden="true">
        <span><IconServer />local 01</span>
        <span><IconServer />local 02</span>
        <span><IconServer />local 03</span>
      </div>
      <IconWifi className={synced ? 'flow-arrow tier-sync tier-sync--active' : 'flow-arrow tier-sync'} />
      <div className="redis-core">
        <IconDatabase /><strong>Redis</strong><span>sync ~1s</span>
      </div>
      <div className="atomic-results">
        <div className="metric-row">
          <Metric label="budget" value="100 / min" />
          <Metric label="admitted" tone="yellow" value={synced ? '105' : '—'} />
          <Metric label="Redis calls" value={synced ? '1k / s' : '100k / s' } />
          <Metric label="service" value="UP" />
        </div>
        <p>{synced ? 'Five requests slipped past the limit during the sync gap. The service stayed up.' : 'Each local node counts in memory and reconciles with Redis on a short interval.'}</p>
        <div className="demo-actions">
          <button type="button" onClick={runOverBudget}>Burst during sync window</button>
          <button type="button" className="button-secondary" onClick={reset}>Reset</button>
        </div>
      </div>
    </div>
  )
}

function Notes({ children }: { children: ReactNode }) {
  return <aside className="notes">{children}</aside>
}

function blurInteractiveControl(): void {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

export default function Presentation() {
  return (
    <div className="presentation-root" onKeyDownCapture={blurInteractiveControl}>
      <Deck config={deckConfig} onSlideChange={blurInteractiveControl}>
      <Slide className="slide-title" backgroundGradient="radial-gradient(circle at 75% 30%, #113a43 0, #080d12 42%, #05080b 100%)">
        <div className="title-lockup">
          <h1>Rate Limiting:<br />Making everyone<br /><em>equally unhappy!</em></h1>
          <p className="title-authors">Bartosz Gałek&emsp;&emsp;&emsp;&emsp;Ece Tavasli</p>
        </div>
        <div className="hero-gauge" aria-hidden="true"><span>429</span></div>
        <Notes>Open with the promise: this is not a catalogue of algorithms. It is a sequence of attacks that forces the design to evolve.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Why it exists</Eyebrow>
        <h2>Every shared service eventually meets an unfair user</h2>
        <div className="fiasco-grid fiasco-grid--spaced">
          <article><IconAlertTriangle /><strong>3.5B</strong><h3>system requests</h3><p>Ticketmaster reported unprecedented bot traffic and demand during the 2022 Taylor Swift presale.</p></article>
          <article><IconBrandGithub /><strong>60 → 5,000</strong><h3>API requests / hour</h3><p>GitHub’s core REST API budget changes dramatically when a request has an identity.</p></article>
          <article><IconBrandReddit /><strong>Access is a product</strong><h3>not an implementation detail</h3><p>Quotas, pricing, and policy changes can reshape — or retire — entire API ecosystems.</p></article>
        </div>
        <Notes>
          A limit protects capacity, enforces fairness, and defines the product boundary.
          {' '}Sources: https://business.ticketmaster.com/business-solutions/taylor-swift-the-eras-tour-onsale-explained/ ; https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api ; https://www.redditinc.com/blog/2023apiupdates
        </Notes>
      </Slide>

      <Slide>
        <Eyebrow>The core question</Eyebrow>
        <h2>Should this request be allowed, or not?</h2>
        <div className="fiasco-grid fiasco-grid--centered">
          <article><IconTarget /><strong>Accuracy</strong><h3>how exact must the count be?</h3></article>
          <article><IconCoin /><strong>Cost</strong><h3>what can you afford to track?</h3></article>
          <article><IconActivity /><strong>Burst behavior</strong><h3>absorb, reject, or smooth?</h3></article>
        </div>
        <p className="takeaway">No single algorithm wins on all three. <span className="takeaway-accent">That’s why there are several!</span></p>
        <Notes>
          Every rate limiter answers that one question — the trade-offs are all in how.
          {' '}Accuracy: selling scarce inventory — tickets, marketplace listings — you can't overshoot. Sloppy counting sells the same item twice.
          {' '}Cost: accuracy needs identity — user, API key, IP — held in memory and checked on every request. That adds up at millions of requests.
          {' '}Burst behavior: short spikes above the sustained rate happen. Decide whether to let them through, queue them, or cut them off.
          {' '}Frame this as the menu for the rest of the talk: every algorithm we look at is a different trade-off between these three axes, not a strictly better version of the last one.
        </Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 01</Eyebrow>
        <h2>Fixed Window</h2>
        <AlgorithmDemo
          component={FixedWindowVisualization}
          limit={6}
          height={420}
          legend={<p><i className="legend-dot" /> allowed <i className="legend-dash" /> rejected</p>}
        />
        <Notes>
          Divide time into fixed intervals (e.g. 1-minute boxes). Keep a counter per key, per window. Each request increments the counter; once it exceeds the limit, reject. When the window rolls over, the limit resets.
          {' '}Pros: very simple to implement; O(1) memory and CPU, cheap at any scale; easy to explain; resets are predictable, so debugging is easy too.
          {' '}Cons: prone to spikes at the boundary — up to 2x expected load; encourages thundering herds (clients honoring X-Retry-At all retry at exactly the same moment); no burst allowance.
          {' '}Okay for e.g. login attempts, not good for protecting backend capacity.
        </Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 02</Eyebrow>
        <h2>Token Bucket</h2>
        <AlgorithmDemo
          component={TokenBucketVisualization}
          limit={6}
          refillIntervalMs={1_000}
          refillRate={1}
          height={420}
          legend={<p><i className="legend-dot" /> token available <i className="legend-dash" /> request rejected</p>}
        />
        <Notes>
          A bucket has max capacity M and refill rate R/second. Each request consumes a token (or several, for weighted rate limiting). Enough tokens → allow; otherwise reject. Token count is computed lazily at request time, so there's no background work.
          {' '}Pros: burst tolerance — spend all your tokens at once, no problem; O(1) memory per key; easy for weighted costs (LLM gateways price by model tokens); easy to explain ("100 req/s sustained, burst to 500" → bucket size 500, refills 100/s); wide support (Guava RateLimiter, Envoy, Kong, cloud API gateways ship it by default).
          {' '}Cons: if the backend was sized for sustained traffic, a burst can bring it down; distributed state is hard without a centralized source of truth — sharded per-node state can break under uneven load balancing, and a non-atomic read-modify-write on shared buckets can over-admit; fresh keys start with full buckets, so rotating keys/IPs is an easy exploit.
          {' '}Good default for general-purpose API rate limiting when clients are bursty and you're protecting against sustained overuse rather than small bursts.
        </Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 03</Eyebrow>
        <h2>Leaky Bucket</h2>
        <AlgorithmDemo
          component={LeakyBucketVisualization}
          limit={6}
          refillIntervalMs={1_000}
          refillRate={1}
          height={420}
          legend={<p><i className="legend-dot" /> queued <i className="legend-dash" /> rejected</p>}
        />
        <Notes>
          Requests are queued in a bucket with fixed capacity; the queue drains at a constant rate. Any new request that overflows the bucket is rejected. Output is a constant stream of requests, regardless of how bursty the input traffic is.
          {' '}Pros: constant-rate output — the backend knows what to expect, no unexpected spikes; tolerates short-term bursts by just processing them at a steady rate.
          {' '}Cons: latency — requests wait in the queue, and by the time one is processed reality may already be stale (e.g. you were buying the last seat at a concert, but by the time your request was processed it was already gone); punishes legitimate bursty traffic.
          {' '}Use when your backend needs steady-state request handling.
        </Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 04</Eyebrow>
        <h2>Sliding Window Log</h2>
        <AlgorithmDemo component={SlidingWindowVisualization} limit={6} height={420} />
        <Notes>
          Store [timestamp][key] per request. On each new request, evict entries older than the window, count what remains, and decide allow/reject. Because the window follows the wall clock, enforcement is exact.
          {' '}Pros: perfectly accurate; because the log is a record of recent requests, it helps resolve disputes ("you rate limited me unfairly").
          {' '}Cons: O(N) memory per key (N = number of requests) — cost scales with the volume it's handling, bad for large volume; extra eviction work on every request means the limiter itself becomes the hotspot; on Redis this is typically multiple operations plus sorting (ZADD + ZREMRANGEBYSCORE + ZCARD).
          {' '}Use only when exactness is a hard requirement and per-key volume is low (e.g. an export operation at 5 req/h). Rarely the right answer for high-throughput API limiting.
        </Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 05</Eyebrow>
        <h2>Sliding Window Counter</h2>
        <FloatingWindowFormula />
        <Notes>
          A hybrid: use a fixed-window counter, but estimate the sliding-window count by weighting the previous window's counter by how much it still overlaps the sliding window. E.g. if the current window is 40% elapsed, estimated count = current count + 0.6 × previous counter. Admit if the estimate is under the limit.
          {' '}Pros: good balance of accuracy and cost — two counters and a timestamp per key, O(1) everything; eliminates the 2x boundary problem; smooths the thundering-herd-at-reset behavior of fixed windows a little.
          {' '}Cons: it's an estimate — the weighting assumes requests in the previous window were uniformly distributed, which isn't true for bursty traffic, so it can over- or under-admit at the margins; much harder to explain to consumers, since behavior near the limit is fuzzy; no explicit burst allowance.
          {' '}Best for high-scale requests when burst tolerance isn't a requirement (or when downstream really can't handle it).
        </Notes>
      </Slide>

      <Slide>
        <h2>Request count is a poor proxy for work</h2>
        <WeightedCostDemo />
        <Notes>Press export three times. The first two consume the budget; the third receives 429. Then reset and contrast with ping. Not every request costs the same — price the endpoint, not the hit.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>What teams usually deploy first</Eyebrow>
        <h2>Use the limiter already sitting in the request path</h2>
        <div className="layer-stack">
          <article><IconBrandCloudflare /><div><span>Edge networks</span><strong>Cloudflare · AWS API Gateway</strong><p>Absorb broad abuse before it reaches your network.</p></div></article>
          <article><IconNetwork /><div><span>Load balancers & reverse proxies</span><strong>NGINX · HAProxy · Envoy · Traefik</strong><p>Enforce simple local or shared counters close to the app.</p></div></article>
          <article><IconApi /><div><span>API gateways</span><strong>Kong · Apache APISIX</strong><p>Attach policies to consumers, routes, credentials, and plans.</p></div></article>
        </div>
        <p className="takeaway">Start here. Move inward only when the policy needs application context.</p>
        <Notes>Sources: official documentation for Cloudflare rate limiting rules, AWS API Gateway throttling, NGINX limit_req, HAProxy stick tables, Envoy rate limit filter, Traefik rateLimit middleware, Kong rate limiting, and APISIX limit-count.</Notes>
      </Slide>

      <Slide className="slide-sketches">
        <h1>Sketches</h1>
      </Slide>

      <Slide className="interlude" backgroundGradient="linear-gradient(135deg, #4a1731 0%, #160d17 55%, #080d12 100%)">
        <Eyebrow>When “requests per IP” is not enough</Eyebrow>
        <h2>Good cop / Bad cop</h2>
        <div className="versus"><span>defense</span><strong>VS</strong><span>adaptation</span></div>
        <Notes>Cue the adversarial section. Each defense changes what the attacker targets next.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 01 · identity</Eyebrow>
        <h2>An IP address is routing data, not a user</h2>
        <IdentityDemo />
        <Notes>Bad cop rotates 10,000 IPs — each gets a fresh individual budget, every request gets through, server overloads. Good cop keys the limiter to the credential instead: same flood, one shared budget, most of it now gets blocked.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 02 · boundary burst</Eyebrow>
        <h2>“I stayed within the limit.”</h2>
        <WindowBoundaryDemo />
        <Notes>Run the thundering herd: 100 requests at 11:59:59, another 100 at 12:00:01 — both windows are legal, 200 requests land in 2 seconds. Switching to a sliding window keeps the first burst's timestamps in the lookback, so the second burst is rejected outright.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 03 · overload</Eyebrow>
        <h2>A breaker protects the database. Cost protects everyone.</h2>
        <OverloadCostDemo />
        <Notes>Ten heavy /export calls a minute stay under any request-count limit but overload the database. Tripping a circuit breaker saves the database but returns 503 to every client, attacker included. Pricing /export at 50 tokens instead of counting requests blocks only the attacker — everyone else keeps getting 200.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 04 · concurrency</Eyebrow>
        <h2>The algorithm can be right while the architecture is wrong</h2>
        <AtomicityDemo />
        <Notes>Run the sequential test first: exactly 100 successes and then 100 rejections. Now keep the same 100-token budget but fire 200 requests concurrently: 115 successes illustrates the overshoot caused by edge nodes racing to sync with Redis. Then run atomic Lua: exactly 100. The 115 value is a deterministic teaching example, not benchmark data.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 05 · atomic Redis Lua</Eyebrow>
        <h2>Move the decision to the state</h2>
        <ScenarioState step="05 · same burst" control="Redis EVAL · one round trip" event="the race is gone; now the limiter itself becomes the next shared dependency" />
        <div className="lua-layout">
          <pre><code>{`local used = redis.call('GET', key) or 0\nif used + cost > limit then\n  return {0, limit - used}\nend\nredis.call('INCRBY', key, cost)\nredis.call('PEXPIRE', key, window)\nreturn {1, limit - used - cost}`}</code></pre>
          <div className="lua-benefits"><div><IconLock /><strong>Atomic</strong><span>No check/update gap</span></div><div><IconBolt /><strong>One trip</strong><span>Math runs inside Redis</span></div><div><IconStack2 /><strong>Consistent</strong><span>Headers reflect one authority</span></div></div>
        </div>
        <div className="metric-row lua-metrics">
          <Metric label="check → update gap" value="0 ms" />
          <Metric label="network trips / decision" value="1" />
          <Metric label="headers" tone="yellow" value="100 / 100 in sync" />
        </div>
        <p className="warning"><IconAlertTriangle /> Lua removes a race. It does not remove hot keys, regional latency, failover, or capacity planning.</p>
        <Notes>Keep scripts short: while a script runs, other commands wait. Source: https://redis.io/docs/latest/develop/programmability/eval-intro/</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 06 · scale</Eyebrow>
        <h2>Perfect consistency doesn’t scale infinitely</h2>
        <RedisMeltdownDemo />
        <Notes>A 100k rps load test aimed at the limiter itself: every decision is still correct, but the single Lua-evaluating thread can't keep up and the service goes down. Switching to two-tier moves most of the checking off Redis entirely — CPU drops, service recovers.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 07 · eventual consistency</Eyebrow>
        <h2>Two-tier rate limiting: trade strict math for uptime</h2>
        <TwoTierDemo />
        <Notes>Each local node counts in memory and reconciles with Redis every ~1s instead of on every request. A burst timed to the sync gap can slip 5 extra requests through — an acceptable trade at hyper-scale, because the goal shifts from exact enforcement to keeping the database alive.</Notes>
      </Slide>

      <Slide className="interlude interlude--close" backgroundGradient="linear-gradient(135deg, #103846 0%, #0d1a1f 55%, #080d12 100%)">
        <Eyebrow>Dropping character</Eyebrow>
        <h2>Rate limiting isn’t a checkbox. It’s an evolving strategy.</h2>
        <div className="duel-lines duel-lines--wide">
          <RoleLine role="good">A series of deliberate trade-offs. Protect your boundaries with IP and API-key limits. When traffic gets smarter, protect your database with cost-based limits. When attackers exploit network physics, lock it down with atomicity. And at hyper-scale, trade strict consistency to keep the servers alive.</RoleLine>
          <RoleLine role="bad">And how quickly you can deploy a Lua script when things go wrong.</RoleLine>
        </div>
        <p className="takeaway">You don’t need a two-tier architecture on day one — but you do need to know what happens to your system when the traffic changes.</p>
        <Notes>Both performers break character here. This is the thesis of the talk, stated plainly before the recap.</Notes>
      </Slide>

      <Slide className="slide-close" backgroundGradient="radial-gradient(circle at 50% 40%, #103846 0, #080d12 50%, #05080b 100%)">
        <IconShield className="close-icon" />
        <h2>Fairness is a distributed systems feature.</h2>
        <p>Count the right identity. Price the real work. Update state atomically. Know when to stop counting.</p>
        <div className="closing-rule"><span>429</span><span>before</span><span>503</span></div>
        <Notes>Final line: a good limiter rejects a little traffic early so the system does not reject everyone later. Thank you.</Notes>
      </Slide>
      </Deck>
    </div>
  )
}
