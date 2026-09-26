// A tiny, purpose-built system-topology model for the cop-arena narrative. Not a
// generic layout engine — there are only 4 shapes the story ever needs (single
// service, service+db, load-balanced edges+shared store, two-tier), so each is a
// plain function returning fixed coordinates rather than something that computes
// layout at runtime.

export type NodeId = string
export type NodeIcon = 'client' | 'lb' | 'server' | 'db' | 'store'
export type NodeHealth = 'idle' | 'ok' | 'warm' | 'hot' | 'down'

export type TopologyNode = {
  id: NodeId
  x: number
  y: number
  label: string
  icon: NodeIcon
  health?: NodeHealth
  sublabel?: string
  counter?: { value: number; max: number }
  /** Transient "under active load right now" jolt — grows and jitters the node, independent of health's steady-state color. */
  shaking?: boolean
  /** Graded version of `shaking` — grows/jitters more intensely at higher levels, for a "gets worse each hit" escalation. */
  shakeLevel?: 1 | 2 | 3
  /** Smaller icon — for stages that fan out many nodes (e.g. edge servers) where full size would overlap. */
  compact?: boolean
  /** A tiny db-icon badge on the node's corner — "this node keeps its own local copy". */
  cornerBadge?: boolean
}

export type EdgeStyle = 'solid' | 'dotted' | 'beam'

export type TopologyEdge = {
  id: string
  from: NodeId
  to: NodeId
  style?: EdgeStyle
  breaker?: 'closed' | 'open'
}

export type TopologyStage = { nodes: TopologyNode[]; edges: TopologyEdge[]; height?: number; width?: number }

export type PulseRole = 'legit' | 'attacker'
export type PulseVariant = 'request' | 'reject' | 'sync' | 'race'

export type FlowPulse = {
  id: string
  edgeId: string
  role?: PulseRole
  variant?: PulseVariant
  label?: string
  delayMs?: number
  durationMs?: number
  /** 'lg' for an oversized ball — a visibly heavy/expensive request or response. */
  size?: 'lg'
  /** Travel the edge's `to -> from` direction instead of `from -> to` (e.g. a slow response heading back). */
  reverse?: boolean
  /** Emoji rendered inside the ball itself (e.g. a happy/sad face), distinct from `label`'s floating caption. */
  face?: string
  /** Tints the ball purple — a request that timed out (held, then bounced back) rather than a normal reject. */
  timeout?: boolean
  /** Tints the ball red — a request bounced back because the budget/limit was already exhausted. */
  blocked?: boolean
  /** Plays the travel once and stays disappeared at the destination, instead of looping forever. */
  once?: boolean
  /** For a `once` pulse: how far along the edge (CSS percentage, e.g. `'48%'`) it travels before disappearing — defaults to the full edge. */
  arriveDistance?: string
}

// Fixed pixel canvas — reveal.js scales the whole 1280x720 slide uniformly via a
// CSS transform, so inner content can use fixed px coordinates safely (the same
// convention `skew-track`/`herd-demo` already rely on in index.css).
export const CANVAS_WIDTH = 1160
export const CANVAS_HEIGHT = 260
const MID_Y = CANVAS_HEIGHT / 2

function edge(from: NodeId, to: NodeId, opts: Partial<Omit<TopologyEdge, 'id' | 'from' | 'to'>> = {}): TopologyEdge {
  return { id: `${from}->${to}`, from, to, ...opts }
}

/** Maps a `loadPercent()` reading to a coarse health bucket, so node color is always traceable to a stated number. */
export function healthFromLoad(percent: number): NodeHealth {
  if (percent >= 90) return 'down'
  if (percent >= 65) return 'hot'
  if (percent >= 30) return 'warm'
  return 'ok'
}

export function singleDbStage(opts: {
  serverHealth?: NodeHealth
  dbHealth?: NodeHealth
  dbSublabel?: string
  breaker?: 'closed' | 'open'
} = {}): TopologyStage {
  return {
    nodes: [
      { id: 'client', x: 80, y: MID_Y, label: 'traffic', icon: 'client' },
      { id: 'server', x: 480, y: MID_Y, label: 'service', icon: 'server', health: opts.serverHealth ?? 'ok' },
      { id: 'db', x: 1000, y: MID_Y, label: 'database', icon: 'db', health: opts.dbHealth ?? 'ok', sublabel: opts.dbSublabel },
    ],
    edges: [edge('client', 'server'), edge('server', 'db', { breaker: opts.breaker })],
  }
}

export function dbOnlyStage(opts: { dbHealth?: NodeHealth; dbSublabel?: string } = {}): TopologyStage {
  return {
    nodes: [{ id: 'db', x: CANVAS_WIDTH / 2, y: MID_Y, label: 'database', icon: 'db', health: opts.dbHealth ?? 'ok', sublabel: opts.dbSublabel }],
    edges: [],
  }
}

export function singleStoreStage(opts: { storeHealth?: NodeHealth; storeSublabel?: string } = {}): TopologyStage {
  return {
    nodes: [
      { id: 'client', x: 80, y: MID_Y, label: 'traffic', icon: 'client' },
      { id: 'server', x: 480, y: MID_Y, label: 'service', icon: 'server' },
      { id: 'store', x: 1000, y: MID_Y, label: 'shared counter', icon: 'store', health: opts.storeHealth ?? 'ok', sublabel: opts.storeSublabel },
    ],
    edges: [edge('client', 'server'), edge('server', 'store')],
  }
}

// Same service+store pair as `singleStoreStage`, just squeezed into a narrower canvas —
// for the beat that needs real screen space next to the diagram (a live request log)
// instead of the usual full-width centered layout.
const SEQUENTIAL_STAGE_WIDTH = 620

export function sequentialCounterStage(opts: { storeHealth?: NodeHealth; storeSublabel?: string } = {}): TopologyStage {
  return {
    width: SEQUENTIAL_STAGE_WIDTH,
    nodes: [
      { id: 'client', x: 70, y: MID_Y, label: 'traffic', icon: 'client' },
      { id: 'server', x: 330, y: MID_Y, label: 'service', icon: 'server' },
      { id: 'store', x: 560, y: MID_Y, label: 'shared counter', icon: 'store', health: opts.storeHealth ?? 'ok', sublabel: opts.storeSublabel },
    ],
    edges: [edge('client', 'server'), edge('server', 'store')],
  }
}

// This stage fans out to 4 edge nodes stacked vertically, so it needs far more
// vertical room than the shared CANVAS_HEIGHT gives every other (single-row) stage —
// hence its own taller local canvas and compact edge-node icons, rather than
// touching CANVAS_HEIGHT/MID_Y and affecting every other stage.
const FAN_STAGE_HEIGHT = 420
const FAN_MID_Y = FAN_STAGE_HEIGHT / 2
const FAN_EDGE_YS = [60, 160, 260, 360]

export function lbFanStoreStage(opts: {
  edgeHealth?: NodeHealth
  storeHealth?: NodeHealth
  storeLabel?: string
  storeSublabel?: string
  beamToLb?: boolean
} = {}): TopologyStage {
  const edgeNodes: TopologyNode[] = FAN_EDGE_YS.map((y, i) => ({
    id: `edge-${i + 1}`,
    x: 620,
    y,
    label: `edge ${String(i + 1).padStart(2, '0')}`,
    icon: 'server',
    health: opts.edgeHealth ?? 'ok',
    compact: true,
  }))
  return {
    height: FAN_STAGE_HEIGHT,
    nodes: [
      { id: 'client', x: 60, y: FAN_MID_Y, label: 'traffic', icon: 'client' },
      { id: 'lb', x: 300, y: FAN_MID_Y, label: 'load balancer', icon: 'lb' },
      ...edgeNodes,
      { id: 'store', x: 1080, y: FAN_MID_Y, label: opts.storeLabel ?? 'shared counter', icon: 'store', health: opts.storeHealth ?? 'ok', sublabel: opts.storeSublabel },
    ],
    edges: [
      edge('client', 'lb', { style: opts.beamToLb ? 'beam' : 'solid' }),
      ...edgeNodes.map((n) => edge('lb', n.id)),
      ...edgeNodes.map((n) => edge(n.id, 'store')),
    ],
  }
}
