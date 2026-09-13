import { Deck, Slide } from '@revealjs/react'
import {
  IconAlertTriangle, IconApi, IconArrowRight, IconBolt,
  IconBrandCloudflare, IconBrandGithub, IconBrandReddit, IconBrandX,
  IconCheck, IconCircuitSwitchOpen, IconClock, IconDatabase,
  IconFingerprint, IconGauge, IconKey, IconLock, IconNetwork,
  IconRefresh, IconServer, IconShield, IconStack2, IconUsers, IconX,
} from '@tabler/icons-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import 'reveal.js/reveal.css'
import {
  FixedWindowVisualization,
  FloatingWindowVisualization,
  SlidingWindowVisualization,
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

function WindowBoundaryDemo() {
  const [active, setActive] = useState(false)

  function runBurst(): void { setActive(true) }
  function reset(): void { setActive(false) }

  return (
    <div className="boundary-demo">
      <div className="boundary-clock"><span>11:59:59</span><span className="boundary-line" /><span>12:00:01</span></div>
      <div className="boundary-bars" aria-live="polite">
        <div className={active ? 'burst burst--active' : 'burst'}>{active ? '100' : '0'}</div>
        <div className={active ? 'burst burst--active' : 'burst'}>{active ? '100' : '0'}</div>
      </div>
      <div className="demo-actions">
        <button type="button" onClick={runBurst}>Run thundering herd</button>
        <button type="button" className="button-secondary" onClick={reset}>Reset</button>
        <strong>{active ? '200 requests / 2 seconds' : '2 legal windows'}</strong>
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
  const [result, setResult] = useState<'idle' | 'racy' | 'atomic'>('idle')

  function runRacyBurst(): void { setResult('racy') }
  function runAtomicBurst(): void { setResult('atomic') }

  return (
    <div className="atomicity-demo">
      <div className="edge-nodes" aria-hidden="true"><span>edge 01</span><span>edge 02</span><span>edge 03</span><span>edge 04</span></div>
      <IconArrowRight className="flow-arrow" />
      <div className={result === 'atomic' ? 'redis-core redis-core--atomic' : 'redis-core'}>
        <IconDatabase /><strong>Redis</strong><span>{result === 'atomic' ? 'EVAL' : 'GET → SET'}</span>
      </div>
      <div className="atomic-results">
        <div className="metric-row">
          <Metric label="successful" value={result === 'idle' ? '—' : result === 'racy' ? '115' : '100'} />
          <Metric label="rejected" tone="yellow" value={result === 'idle' ? '—' : result === 'racy' ? '85' : '100'} />
        </div>
        <p>{result === 'racy' ? '15 requests slipped through the check/update gap.' : result === 'atomic' ? 'The decision and update became one indivisible operation.' : 'Fire 200 concurrent requests at a budget of 100.'}</p>
        <div className="demo-actions">
          <button type="button" className="button-danger" onClick={runRacyBurst}>Run read-then-write</button>
          <button type="button" onClick={runAtomicBurst}>Run atomic Lua</button>
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
          <Eyebrow>Rate limiting, visualized</Eyebrow>
          <h1>How to say<br /><em>“not so fast”</em><br />without saying “no”</h1>
          <p>Algorithms, attacks, and the distributed systems gap between them.</p>
        </div>
        <div className="hero-gauge" aria-hidden="true"><span>429</span></div>
        <Notes>Open with the promise: this is not a catalogue of algorithms. It is a sequence of attacks that forces the design to evolve.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Why it exists</Eyebrow>
        <h2>Every shared service eventually meets an unfair user</h2>
        <div className="fiasco-grid">
          <article><IconAlertTriangle /><strong>3.5B</strong><h3>system requests</h3><p>Ticketmaster reported unprecedented bot traffic and demand during the 2022 Taylor Swift presale.</p></article>
          <article><IconBrandGithub /><strong>60 → 5,000</strong><h3>API requests / hour</h3><p>GitHub’s core REST API budget changes dramatically when a request has an identity.</p></article>
          <article><IconBrandReddit /><strong>Access is a product</strong><h3>not an implementation detail</h3><p>Quotas, pricing, and policy changes can reshape — or retire — entire API ecosystems.</p></article>
        </div>
        <p className="takeaway">A limit protects capacity, enforces fairness, and defines the product boundary.</p>
        <Notes>Sources: https://business.ticketmaster.com/business-solutions/taylor-swift-the-eras-tour-onsale-explained/ ; https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api ; https://www.redditinc.com/blog/2023apiupdates</Notes>
      </Slide>

      <Slide>
        <Eyebrow>The contract</Eyebrow>
        <h2>A limiter answers one small question very quickly</h2>
        <div className="decision-flow">
          <div><IconFingerprint /><span>Who?</span><strong>identity</strong></div><IconArrowRight />
          <div><IconClock /><span>When?</span><strong>time window</strong></div><IconArrowRight />
          <div><IconGauge /><span>How much?</span><strong>cost</strong></div><IconArrowRight />
          <div className="decision-output"><IconShield /><span>Decision</span><strong>allow / reject</strong></div>
        </div>
        <pre className="response-code"><code>{`HTTP/1.1 429 Too Many Requests\nRetry-After: 42\nRateLimit-Limit: 100\nRateLimit-Remaining: 0`}</code></pre>
        <Notes>The core decision is identity plus policy plus shared state. Header naming varies by implementation and standard adoption.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 01 · fixed window</Eyebrow>
        <h2>Reset the full allowance on a schedule</h2>
        <div className="visualization-layout">
          <div className="visual-copy"><p>Count requests inside a wall-clock interval. Reset at the next boundary.</p><ul><li><IconCheck />Tiny state</li><li><IconCheck />Easy to explain</li><li><IconX />Boundary spike</li></ul></div>
          <div className="live-canvas"><FixedWindowVisualization limit={6} height={230} /><p><i className="legend-dot" /> allowed <i className="legend-dash" /> rejected</p></div>
        </div>
        <Notes>Select Send request several times. The implementation is cheap: one counter and one expiry per key.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Attack 01 · boundary burst</Eyebrow>
        <h2>“I stayed within the limit.”</h2>
        <RoleLine role="bad">100 requests at 11:59:59. Another 100 at 12:00:01.</RoleLine>
        <WindowBoundaryDemo />
        <RoleLine role="good">The counter is correct. The protection is not.</RoleLine>
        <Notes>Run the thundering herd. A fixed window permits twice the nominal budget across adjacent boundaries.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 02 · sliding window log</Eyebrow>
        <h2>Capacity returns one request at a time</h2>
        <div className="visualization-layout visualization-layout--reverse">
          <div className="live-canvas"><SlidingWindowVisualization limit={6} height={230} /></div>
          <div className="visual-copy"><p>Keep every accepted timestamp until it leaves the lookback interval.</p><ul><li><IconCheck />Exact decisions</li><li><IconCheck />No boundary spike</li><li><IconX />State grows with traffic</li></ul></div>
        </div>
        <Notes>Compare the moving blue region with fixed blocks. Every request expires independently.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 03 · sliding window counter</Eyebrow>
        <h2>Two counters approximate the moving window</h2>
        <div className="formula">estimate = previous × overlap + current</div>
        <div className="visualization-layout">
          <div className="visual-copy"><p>Weight the previous bucket by the fraction that still overlaps the lookback.</p><ul><li><IconCheck />Constant state</li><li><IconCheck />Smooth enough for most APIs</li><li><IconX />Approximate at the edges</li></ul></div>
          <div className="live-canvas"><FloatingWindowVisualization limit={6} height={230} /></div>
        </div>
        <Notes>The counter version trades exact timestamps for two integers and a little arithmetic.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Algorithm 04 · weighted rate limiting</Eyebrow>
        <h2>Request count is a poor proxy for work</h2>
        <RoleLine role="bad">Ten export requests per minute. Well under your limit. Very far over your database budget.</RoleLine>
        <WeightedCostDemo />
        <Notes>Press export three times. The first two consume the budget; the third receives 429. Then reset and contrast with ping.</Notes>
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

      <Slide className="interlude" backgroundGradient="linear-gradient(135deg, #4a1731 0%, #160d17 55%, #080d12 100%)">
        <Eyebrow>When “requests per IP” is not enough</Eyebrow>
        <h2>Good cop / Bad cop</h2>
        <div className="versus"><span>defense</span><strong>VS</strong><span>adaptation</span></div>
        <Notes>Cue the adversarial section. Each defense changes what the attacker targets next.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 01 · identity</Eyebrow>
        <h2>An IP address is routing data, not a user</h2>
        <div className="duel-grid">
          <div><RoleLine role="bad">My botnet has 10,000 IPs.</RoleLine><div className="botnet"><IconBrandX /><IconBrandX /><IconBrandX /><IconBrandX /><IconBrandX /><IconBrandX /></div><p>Rotate proxies. Reset every IP budget.</p></div>
          <div><RoleLine role="good">Budget the credential instead.</RoleLine><div className="identity-key"><IconKey /><span>API key / JWT subject</span></div><p>One principal. One fixed-window budget.</p></div>
        </div>
        <p className="takeaway">Choose the strongest identity available — then plan for shared accounts and stolen credentials.</p>
        <Notes>Bad cop runs rotating proxies. Good cop switches the key from source IP to authenticated principal.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 02 · overload</Eyebrow>
        <h2>A circuit breaker protects the dependency — after it hurts</h2>
        <div className="circuit-scene">
          <div><IconUsers /><strong>clients</strong></div><IconArrowRight /><div><IconServer /><strong>/export</strong></div><IconArrowRight />
          <div className="breaker"><IconCircuitSwitchOpen /><strong>OPEN</strong><span>503</span></div><IconArrowRight /><div><IconDatabase /><strong>database</strong></div>
        </div>
        <div className="duel-lines"><RoleLine role="good">The database survived.</RoleLine><RoleLine role="bad">And nobody can use /export. I still denied service.</RoleLine></div>
        <Notes>Clarify the distinction: a circuit breaker is a reactive stability mechanism, not an abuse budget.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 03 · concurrency</Eyebrow>
        <h2>The algorithm can be right while the architecture is wrong</h2>
        <AtomicityDemo />
        <Notes>Run read-then-write first: 115 successes illustrates an overshoot caused by concurrent checks. Then run atomic Lua: exactly 100. The 115 value is a deterministic teaching example, not benchmark data.</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Round 04 · atomic Redis Lua</Eyebrow>
        <h2>Move the decision to the state</h2>
        <div className="lua-layout">
          <pre><code>{`local used = redis.call('GET', key) or 0\nif used + cost > limit then\n  return {0, limit - used}\nend\nredis.call('INCRBY', key, cost)\nredis.call('PEXPIRE', key, window)\nreturn {1, limit - used - cost}`}</code></pre>
          <div className="lua-benefits"><div><IconLock /><strong>Atomic</strong><span>No check/update gap</span></div><div><IconBolt /><strong>One trip</strong><span>Math runs inside Redis</span></div><div><IconStack2 /><strong>Consistent</strong><span>Headers reflect one authority</span></div></div>
        </div>
        <p className="warning"><IconAlertTriangle /> Lua removes a race. It does not remove hot keys, regional latency, failover, or capacity planning.</p>
        <Notes>Keep scripts short: while a script runs, other commands wait. Source: https://redis.io/docs/latest/develop/programmability/eval-intro/</Notes>
      </Slide>

      <Slide>
        <Eyebrow>Design checklist</Eyebrow>
        <h2>The counter is the easy part</h2>
        <div className="checklist-grid">
          <div><span>01</span><IconFingerprint /><strong>Identity</strong><p>IP, account, token, tenant, route — or a hierarchy?</p></div>
          <div><span>02</span><IconGauge /><strong>Cost</strong><p>Is every request equally expensive?</p></div>
          <div><span>03</span><IconDatabase /><strong>State</strong><p>Local, centralized, sharded, or eventually consistent?</p></div>
          <div><span>04</span><IconRefresh /><strong>Failure</strong><p>Fail open, fail closed, or degrade?</p></div>
        </div>
        <p className="takeaway">Design the abuse budget around the scarce resource you actually need to protect.</p>
        <Notes>Close by returning to the opening promise. The best algorithm is the one whose failure mode matches the system.</Notes>
      </Slide>

      <Slide className="slide-close" backgroundGradient="radial-gradient(circle at 50% 40%, #103846 0, #080d12 50%, #05080b 100%)">
        <IconShield className="close-icon" />
        <h2>Fairness is a distributed systems feature.</h2>
        <p>Count the right identity. Price the real work. Update state atomically.</p>
        <div className="closing-rule"><span>429</span><span>before</span><span>503</span></div>
        <Notes>Final line: a good limiter rejects a little traffic early so the system does not reject everyone later.</Notes>
      </Slide>
      </Deck>
    </div>
  )
}
