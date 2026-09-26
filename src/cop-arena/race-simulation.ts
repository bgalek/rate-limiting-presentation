import type { FlowPulse } from './topology-model'

export function fanRequestPulses(count: number, edgeCount: number, opts: { role?: 'legit' | 'attacker' } = {}): FlowPulse[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `fan-${i}`,
    edgeId: `lb->edge-${(i % edgeCount) + 1}`,
    role: opts.role ?? 'attacker',
    variant: 'request',
    durationMs: 700,
    delayMs: i * 35,
  }))
}

/** One green "sync" ball departing a different edge server every `cycleMs`, forever — a background replication heartbeat to the store, decoupled from (and much slower than) request traffic. */
export function edgeSyncPulses(edgeCount: number, cycleMs = 1_000): FlowPulse[] {
  const loopMs = edgeCount * cycleMs
  return Array.from({ length: edgeCount }, (_, i) => ({
    id: `sync-${i}`,
    edgeId: `edge-${i + 1}->store`,
    variant: 'sync',
    durationMs: loopMs / 2.4,
    delayMs: i * cycleMs,
  }))
}

// The full end-to-end burst: client -> lb -> one of `edgeCount` edge servers -> the
// shared store, as three chained one-shot pulses per request (same "hand the ball
// off at each hop" pattern as the export-request/export-request-db chain elsewhere
// in this arena) so every request visibly crosses the whole path, not just the fan-out
// leg `fanRequestPulses` draws. `count` requests arrive `BURST_STAGGER_MS` apart, all
// still in flight together — the concurrent arrival a race condition needs.
const BURST_STAGGER_MS = 60
const BURST_HOP_MS = { toLb: 420, toEdge: 480, toStore: 480 }
const BURST_TOTAL_HOP_MS = BURST_HOP_MS.toLb + BURST_HOP_MS.toEdge + BURST_HOP_MS.toStore

export function burstRequestPulses(count: number, edgeCount: number, opts: { role?: 'legit' | 'attacker' } = {}): FlowPulse[] {
  const role = opts.role ?? 'attacker'
  return Array.from({ length: count }, (_, i) => {
    const edgeNodeId = `edge-${(i % edgeCount) + 1}`
    const start = i * BURST_STAGGER_MS
    const hops: FlowPulse[] = [
      { id: `burst-${i}-lb`, edgeId: 'client->lb', role, once: true, delayMs: start, durationMs: BURST_HOP_MS.toLb },
      { id: `burst-${i}-edge`, edgeId: `lb->${edgeNodeId}`, role, once: true, delayMs: start + BURST_HOP_MS.toLb, durationMs: BURST_HOP_MS.toEdge },
      { id: `burst-${i}-store`, edgeId: `${edgeNodeId}->store`, role, once: true, delayMs: start + BURST_HOP_MS.toLb + BURST_HOP_MS.toEdge, durationMs: BURST_HOP_MS.toStore },
    ]
    return hops
  }).flat()
}

/** When each of `count` `burstRequestPulses` requests lands at the store, in ms from wave start — for timing anything (e.g. an atomicity flash) that should react to each arrival. */
export function burstArrivalTimesMs(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * BURST_STAGGER_MS + BURST_TOTAL_HOP_MS)
}

/** Total time from wave start until every one of `count` `burstRequestPulses` requests has landed. */
export function burstWaveDurationMs(count: number): number {
  return (count - 1) * BURST_STAGGER_MS + BURST_TOTAL_HOP_MS
}

// A nonstop, indefinitely-looping version of the same 3-hop path — every hop shares
// one cycle length, and `count * STAGGER_MS` divides that cycle exactly, so the
// `count` independently-looping lanes tile into one seamless, gapless stream instead
// of visibly drifting in and out of phase with each other over time.
const CONTINUOUS_CYCLE_MS = 900
const CONTINUOUS_STAGGER_MS = 60
const CONTINUOUS_HOP_MS = CONTINUOUS_CYCLE_MS / 2.4

export function continuousFullPathPulses(count: number, edgeCount: number, opts: { role?: 'legit' | 'attacker' } = {}): FlowPulse[] {
  const role = opts.role ?? 'attacker'
  return Array.from({ length: count }, (_, i) => {
    const edgeNodeId = `edge-${(i % edgeCount) + 1}`
    const start = i * CONTINUOUS_STAGGER_MS
    const hops: FlowPulse[] = [
      { id: `cstream-${i}-lb`, edgeId: 'client->lb', role, variant: 'request', durationMs: CONTINUOUS_HOP_MS, delayMs: start },
      { id: `cstream-${i}-edge`, edgeId: `lb->${edgeNodeId}`, role, variant: 'request', durationMs: CONTINUOUS_HOP_MS, delayMs: start + CONTINUOUS_HOP_MS },
      { id: `cstream-${i}-store`, edgeId: `${edgeNodeId}->store`, role, variant: 'request', durationMs: CONTINUOUS_HOP_MS, delayMs: start + CONTINUOUS_HOP_MS * 2 },
    ]
    return hops
  }).flat()
}
