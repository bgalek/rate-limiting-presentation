import { useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { Slide } from '@revealjs/react'
import { DeckShell } from '../shared/deck-shell'
import { Notes } from '../shared/ui'
import {
  FixedWindowVisualization,
  FloatingWindowVisualization,
  LeakyBucketVisualization,
  ResponseHeaders,
  SlidingWindowVisualization,
  TokenBucketVisualization,
  type AlgorithmVisualizationProps,
  type VisualizationSnapshot,
} from '../rate-limit-visualizations'

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
          <FloatingWindowVisualization limit={LIMIT} height={196} speed={2} onSnapshot={setSnapshot} />
        </div>
        <ResponseHeaders snapshot={snapshot} />
      </div>
    </>
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

export default function AlgorithmsDeck() {
  return (
    <DeckShell>
      <Slide>
        <h2>Fixed Window</h2>
        <AlgorithmDemo
          component={FixedWindowVisualization}
          limit={6}
          height={420}
          speed={2}
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
        <h2>Token Bucket</h2>
        <AlgorithmDemo
          component={TokenBucketVisualization}
          limit={6}
          refillIntervalMs={1_000}
          refillRate={1}
          height={420}
          speed={2}
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
        <h2>Leaky Bucket</h2>
        <AlgorithmDemo
          component={LeakyBucketVisualization}
          limit={6}
          refillIntervalMs={1_000}
          refillRate={1}
          height={420}
          speed={2}
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
        <h2>Sliding Window Log</h2>
        <AlgorithmDemo component={SlidingWindowVisualization} limit={6} height={420} speed={2} />
        <Notes>
          Store [timestamp][key] per request. On each new request, evict entries older than the window, count what remains, and decide allow/reject. Because the window follows the wall clock, enforcement is exact.
          {' '}Pros: perfectly accurate; because the log is a record of recent requests, it helps resolve disputes ("you rate limited me unfairly").
          {' '}Cons: O(N) memory per key (N = number of requests) — cost scales with the volume it's handling, bad for large volume; extra eviction work on every request means the limiter itself becomes the hotspot; on Redis this is typically multiple operations plus sorting (ZADD + ZREMRANGEBYSCORE + ZCARD).
          {' '}Use only when exactness is a hard requirement and per-key volume is low (e.g. an export operation at 5 req/h). Rarely the right answer for high-throughput API limiting.
        </Notes>
      </Slide>

      <Slide>
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

    </DeckShell>
  )
}
