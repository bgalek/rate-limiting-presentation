import { useState, type ReactNode } from 'react'
import { FixedWindowVisualization, ResponseHeaders, type VisualizationSnapshot } from '../rate-limit-visualizations'
import './cop-arena.css'
import { LEGIT_LIMIT, LEGIT_WINDOW_MS } from './load-model'
import { fanRequestPulses } from './race-simulation'
import { HeaderStrip, type HeaderStripProps } from './HeaderStrip'
import { RateLimitKeyTag } from './RateLimitKeyTag'
import { BoundaryAlgorithmView, IdentityAlgorithmView, Scoreboard, useBoundaryBurstPulse, useEscalationOnPresence, useTokenAttackStream, type Speaker, type TokenAttackConfig } from './shared'
import { TokenBudget } from './TokenBudget'
import { Topology, type HighlightBoxSpec } from './Topology'
import { dbOnlyStage, lbFanStoreStage, singleDbStage, singleStoreStage, type FlowPulse, type NodeHealth, type TopologyStage } from './topology-model'

type CanvasStrip =
  | { kind: 'identity'; phase: 'idle' | 'attack' | 'fixed' }
  | { kind: 'boundary'; phase: 'fixed-window' | 'sliding-window' }

type Scene = {
  speaker?: Speaker
  keyTag?: { value: string; changed?: boolean }
  /** Big button-styled label for the specific endpoint this beat's traffic is hitting, e.g. "/export". */
  endpointBadge?: string
  canvasStrip?: CanvasStrip
  topology?: TopologyStage
  /** Semi-transparent box drawn around the given topology nodes, with a bug badge — flags "something's off here". */
  highlightBox?: HighlightBoxSpec
  pulses?: FlowPulse[]
  tokenBudget?: { remaining: number; max: number }
  /**
   * Endless stream of request balls, `intervalMs` apart — the first `admitCount` ever
   * spawned are admitted (burning `cost` tokens each from `max`) and every one after that
   * is rejected forever, for as long as this slide is on screen. Drives the token budget
   * display and the admitted/rejected scoreboard together, so they can't drift out of sync.
   */
  tokenAttack?: TokenAttackConfig
  /** Per-endpoint token price list, shown alongside the token budget. */
  costTable?: { endpoint: string; cost: string }[]
  header?: HeaderStripProps
  /** Node id that should grow/jitter in lockstep with the live boundary-burst canvases. */
  shakeNodeOnBurst?: string
  /** Node id that should get redder/shake harder with every hit, for as long as this slide is on screen. */
  escalateNodeOnPresence?: { nodeId: string; stepMs: number; maxLevel: number }
}

const ESCALATION_HEALTH: NodeHealth[] = ['warm', 'warm', 'hot', 'hot']

const SOURCE_IP_KEY = 'IP address'
const IDENTITY_KEY = 'API key / JWT'

// One scene per SCRIPT line (src/shared/script.ts), 1:1 — BEATS[i] is beat i+1.
const BEATS: Scene[] = [
  // 1 — botnet floods in behind naive per-IP limiting. The live per-IP canvases below
  // (via canvasStrip) already are the "incoming requests" graph — no separate topology needed.
  {
    speaker: 'bad',
    keyTag: { value: SOURCE_IP_KEY },
    canvasStrip: { kind: 'identity', phase: 'attack' },
  },
  // 2 — identity + fixed window collapses the botnet onto one shared budget
  {
    speaker: 'good',
    keyTag: { value: IDENTITY_KEY, changed: true },
    canvasStrip: { kind: 'identity', phase: 'fixed' },
  },
  // 3 — boundary-timing burst: same-size burst lands right before AND after the
  // window boundary; fixed window only remembers "now", so both waves get admitted
  {
    speaker: 'bad',
    keyTag: { value: IDENTITY_KEY },
    canvasStrip: { kind: 'boundary', phase: 'fixed-window' },
    topology: dbOnlyStage(),
    shakeNodeOnBurst: 'db',
  },
  // 4 — same burst, same two waves — sliding window doesn't shrink the spike, it
  // just counts correctly across the boundary, so the second wave is now rejected
  // before it ever reaches the db (db load drops because it's protected, not because
  // the attacker sent less)
  {
    speaker: 'good',
    keyTag: { value: IDENTITY_KEY },
    canvasStrip: { kind: 'boundary', phase: 'sliding-window' },
    topology: dbOnlyStage({ dbHealth: 'ok' }),
  },
  // 5 — attacker pivots to a cheap-RPS, expensive-query endpoint: the request itself
  // is small and rare, but it's a huge, slow join — it zips client->server->db,
  // then crawls all the way back; the db visibly gets worse with every hit while
  // this slide is on screen
  {
    speaker: 'bad',
    endpointBadge: '/export',
    topology: singleDbStage({ dbHealth: 'warm' }),
    pulses: [
      { id: 'export-request', edgeId: 'client->server', role: 'attacker', variant: 'request', size: 'lg', durationMs: 350 },
      { id: 'export-request-db', edgeId: 'server->db', role: 'attacker', variant: 'request', size: 'lg', delayMs: 350, durationMs: 350 },
      { id: 'export-response-db', edgeId: 'server->db', role: 'attacker', variant: 'request', size: 'lg', reverse: true, delayMs: 1200, durationMs: 1900 },
      { id: 'export-response', edgeId: 'client->server', role: 'attacker', variant: 'request', size: 'lg', reverse: true, delayMs: 3100, durationMs: 1900 },
      // held at the server (queue backed up behind the slow join) then bounces back on its own timeout, never reaching the db
      { id: 'held-request', edgeId: 'client->server', role: 'attacker', variant: 'request', size: 'lg', delayMs: 1600, durationMs: 400 },
      { id: 'held-timeout', edgeId: 'client->server', variant: 'request', size: 'lg', reverse: true, timeout: true, label: '408 timeout', delayMs: 4500, durationMs: 3_000 },
    ],
    escalateNodeOnPresence: { nodeId: 'db', stepMs: 700, maxLevel: 3 },
  },
  // 6 — circuit breaker trips, saves the db
  {
    speaker: 'good',
    topology: singleDbStage({ dbHealth: 'ok', breaker: 'open' }),
  },
  // 7 — but it punishes everyone, not just the attacker
  {
    speaker: 'bad',
    topology: singleDbStage({ dbHealth: 'ok', breaker: 'open' }),
    header: { status: 503, limit: '—', remaining: '—' },
    pulses: [
      { id: 'breaker-out', edgeId: 'client->server', role: 'legit', variant: 'request', size: 'lg', face: '🙂', durationMs: 2_000 },
      { id: 'breaker-back', edgeId: 'client->server', role: 'attacker', variant: 'request', size: 'lg', face: '😞', reverse: true, delayMs: 2_000, durationMs: 2_000 },
    ],
  },
  // 8 — reactive shield vs. proactive defense; breaker resets
  {
    speaker: 'good',
    topology: singleDbStage({ dbHealth: 'ok', breaker: 'closed' }),
  },
  // 9 — weighted / cost-based limiting introduced
  {
    speaker: 'good',
    topology: singleDbStage({ dbHealth: 'ok', breaker: 'closed' }),
    tokenBudget: { remaining: 100, max: 100 },
    costTable: [
      { endpoint: '/export', cost: '50 tokens' },
      { endpoint: '/ping', cost: '1 token' },
      { endpoint: '/user', cost: '2 tokens' },
    ],
  },
  // 10 — two heavy calls burn the whole budget, every one after that is rejected
  // pre-db — the attacker keeps trying, forever, on an empty tank
  {
    speaker: 'bad',
    topology: singleDbStage({ dbHealth: 'ok', breaker: 'closed' }),
    tokenAttack: { max: 100, cost: 50, admitCount: 2, intervalMs: 1_000, travelMs: 1_200 },
  },
  // 11 — thinking: a budget still needs bookkeeping on every request
  {
    speaker: 'bad',
    topology: singleDbStage({ dbHealth: 'ok' }),
  },
  // 12 — sequential test: one at a time, the math holds exactly — the rate limiter's
  // own counter (not the app db) becomes the relevant piece of the system from here on
  {
    speaker: 'bad',
    topology: singleStoreStage({ storeHealth: 'ok' }),
    highlightBox: { nodeIds: ['server', 'store'] },
  },
  // 13 — burst test: 200 concurrent requests fan out across edge servers
  {
    speaker: 'bad',
    topology: lbFanStoreStage({ storeHealth: 'ok' }),
    pulses: fanRequestPulses(16, 4),
  },
]

function BaselineScene(): ReactNode {
  const [snapshot, setSnapshot] = useState<VisualizationSnapshot | null>(null)
  return (
    <div className="cop-arena">
      <div className="cop-arena__stage">
        <div className="cop-canvas-strip">
          <FixedWindowVisualization
            limit={LEGIT_LIMIT}
            windowMs={LEGIT_WINDOW_MS}
            height={180}
            hideControls
            onSnapshot={setSnapshot}
          />
        </div>
      </div>
      <div className="cop-arena__footer">
        <ResponseHeaders snapshot={snapshot} />
      </div>
    </div>
  )
}

function BeatScene({ scene, beat }: { scene: Scene; beat: number }): ReactNode {
  const burstActive = useBoundaryBurstPulse(!!scene.shakeNodeOnBurst)
  const escalation = useEscalationOnPresence(
    !!scene.escalateNodeOnPresence,
    scene.escalateNodeOnPresence?.stepMs ?? 700,
    scene.escalateNodeOnPresence?.maxLevel ?? 3,
  )
  const attack = useTokenAttackStream(!!scene.tokenAttack, {
    max: scene.tokenAttack?.max ?? 1,
    cost: scene.tokenAttack?.cost ?? 1,
    admitCount: scene.tokenAttack?.admitCount ?? 0,
    intervalMs: scene.tokenAttack?.intervalMs ?? 1_000,
    travelMs: scene.tokenAttack?.travelMs ?? 1_000,
  })

  let topologyStage = scene.topology
  if (topologyStage && scene.shakeNodeOnBurst) {
    topologyStage = {
      ...topologyStage,
      nodes: topologyStage.nodes.map((n) =>
        n.id === scene.shakeNodeOnBurst ? { ...n, shaking: burstActive, health: burstActive ? 'hot' : 'ok' } : n,
      ),
    }
  }
  if (topologyStage && scene.escalateNodeOnPresence) {
    const targetId = scene.escalateNodeOnPresence.nodeId
    topologyStage = {
      ...topologyStage,
      nodes: topologyStage.nodes.map((n) =>
        n.id === targetId
          ? { ...n, health: ESCALATION_HEALTH[escalation.level], shakeLevel: escalation.level > 0 ? (escalation.level as 1 | 2 | 3) : undefined }
          : n,
      ),
    }
  }

  const pulses = scene.tokenAttack
    ? attack.balls.map((ball) => ({
        id: `attack-${ball.id}`,
        edgeId: 'client->server',
        size: 'lg' as const,
        once: true,
        durationMs: scene.tokenAttack!.travelMs,
        ...(ball.admitted ? { role: 'attacker' as const } : { blocked: true }),
      }))
    : scene.pulses

  return (
    <div
      className="cop-arena"
      ref={scene.escalateNodeOnPresence ? escalation.ref : scene.tokenAttack ? attack.ref : undefined}
    >
      <div className="cop-arena__header">
        {scene.keyTag && <RateLimitKeyTag value={scene.keyTag.value} changed={scene.keyTag.changed} />}
        {scene.endpointBadge && <span className="endpoint-badge">{scene.endpointBadge}</span>}
      </div>
      <div className="cop-arena__stage">
        {scene.canvasStrip && (
          <div className="cop-canvas-strip">
            {scene.canvasStrip.kind === 'identity'
              ? <IdentityAlgorithmView phase={scene.canvasStrip.phase} />
              : <BoundaryAlgorithmView phase={scene.canvasStrip.phase} />}
          </div>
        )}
        {topologyStage && (
          <Topology stage={topologyStage} pulses={pulses} replayKey={beat} highlightBox={scene.highlightBox} />
        )}
      </div>
      <div className="cop-arena__footer">
        {scene.costTable && (
          <div className="cost-table">
            {scene.costTable.map((row) => (
              <div key={row.endpoint} className="cost-table__row">
                <span>{row.endpoint}</span>
                <strong>{row.cost}</strong>
              </div>
            ))}
          </div>
        )}
        {scene.tokenBudget && <TokenBudget {...scene.tokenBudget} />}
        {scene.tokenAttack && <TokenBudget remaining={attack.remaining} max={scene.tokenAttack.max} />}
        {scene.header && <HeaderStrip {...scene.header} />}
        {scene.tokenAttack && <Scoreboard ok={`${attack.admitted} × /export`} rejected={`${attack.rejected} · 429`} />}
      </div>
    </div>
  )
}

export function CopArena({ beat }: { beat: number }): ReactNode {
  if (beat === 0) return <BaselineScene />
  const scene = BEATS[beat - 1]
  return <BeatScene scene={scene} beat={beat} />
}
