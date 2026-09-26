import { IconArrowsSplit, IconCircuitSwitchClosed, IconCircuitSwitchOpen, IconDatabase, IconQuestionMark, IconServer, IconUser } from '@tabler/icons-react'
import type { CSSProperties, ReactNode } from 'react'
import { CANVAS_HEIGHT, CANVAS_WIDTH, type FlowPulse, type NodeIcon, type TopologyEdge, type TopologyNode, type TopologyStage } from './topology-model'

export type HighlightBoxSpec = { nodeIds: string[] }

// Exported so callers can position other elements (e.g. a pulse that should stop
// exactly at the highlight box's edge) against the same geometry this draws with.
export const NODE_HALF = 108
export const HIGHLIGHT_PADDING = 26
const NODE_BOTTOM_MARGIN = 150

function HighlightBox({ spec, nodesById }: { spec: HighlightBoxSpec; nodesById: Map<string, TopologyNode> }): ReactNode {
  const nodes = spec.nodeIds.map((id) => nodesById.get(id)).filter((n): n is TopologyNode => !!n)
  if (nodes.length === 0) return null

  const left = Math.min(...nodes.map((n) => n.x)) - NODE_HALF - HIGHLIGHT_PADDING
  const right = Math.max(...nodes.map((n) => n.x)) + NODE_HALF + HIGHLIGHT_PADDING
  const top = Math.min(...nodes.map((n) => n.y)) - NODE_HALF - HIGHLIGHT_PADDING
  const bottom = Math.max(...nodes.map((n) => n.y)) + NODE_BOTTOM_MARGIN + HIGHLIGHT_PADDING

  return (
    <div className="topo__highlight-box" style={{ left, top, width: right - left, height: bottom - top }}>
      <span className="topo__highlight-icon"><IconQuestionMark /></span>
    </div>
  )
}

function AtomicRings({ nodeId, nodesById, flashDelaysMs }: { nodeId: string; nodesById: Map<string, TopologyNode>; flashDelaysMs: number[] }): ReactNode {
  const node = nodesById.get(nodeId)
  if (!node) return null

  return (
    <div className="topo__atomic" style={{ left: node.x, top: node.y }}>
      <span className="topo__atomic-ring topo__atomic-ring--a" />
      <span className="topo__atomic-ring topo__atomic-ring--b" />
      <span className="topo__atomic-ring topo__atomic-ring--c" />
      {flashDelaysMs.map((ms, i) => (
        <span key={i} className="topo__atomic-flash" style={{ '--flash-delay': `${ms}ms` } as CSSProperties} />
      ))}
    </div>
  )
}

function Explosion({ nodeId, nodesById }: { nodeId: string; nodesById: Map<string, TopologyNode> }): ReactNode {
  const node = nodesById.get(nodeId)
  if (!node) return null

  return (
    <div className="topo__explosion" style={{ left: node.x, top: node.y }}>
      <span className="topo__explosion-flash" />
      <span className="topo__explosion-shockwave" />
      <span className="topo__explosion-stem" />
      <span className="topo__explosion-cap" />
    </div>
  )
}

const ICONS: Record<NodeIcon, typeof IconServer> = {
  client: IconUser,
  lb: IconArrowsSplit,
  server: IconServer,
  db: IconDatabase,
  store: IconDatabase,
}

function edgePath(edge: TopologyEdge, nodesById: Map<string, TopologyNode>, reverse = false): string {
  const a = nodesById.get(reverse ? edge.to : edge.from)
  const b = nodesById.get(reverse ? edge.from : edge.to)
  if (!a || !b) return ''
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
}

function BreakerIcon({ edge, nodesById }: { edge: TopologyEdge; nodesById: Map<string, TopologyNode> }): ReactNode {
  const a = nodesById.get(edge.from)
  const b = nodesById.get(edge.to)
  if (!a || !b) return null
  const Icon = edge.breaker === 'open' ? IconCircuitSwitchOpen : IconCircuitSwitchClosed
  return (
    <div
      className={`topo__breaker topo__breaker--${edge.breaker}`}
      style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}
    >
      <Icon />
    </div>
  )
}

function Node({ node }: { node: TopologyNode }): ReactNode {
  const Icon = ICONS[node.icon]
  const health = node.health ?? 'ok'
  const over = node.counter && node.counter.value > node.counter.max
  return (
    <div
      className={`topo__node topo__node--${health}${node.shaking ? ' topo__node--shaking' : ''}${node.shakeLevel ? ` topo__node--shake-${node.shakeLevel}` : ''}${node.compact ? ' topo__node--compact' : ''}`}
      style={{ left: node.x, top: node.y }}
    >
      <div className="topo__node-icon" aria-label={node.label}>
        <Icon />
        {node.cornerBadge && <span className="topo__node-corner-badge"><IconDatabase /></span>}
      </div>
      {node.sublabel && <span className="topo__node-sublabel">{node.sublabel}</span>}
      {node.counter && (
        <div className="topo__node-counter" data-over={over || undefined}>
          <div style={{ width: `${Math.min(100, (node.counter.value / node.counter.max) * 100)}%` }} />
          <small>{node.counter.value}/{node.counter.max}</small>
        </div>
      )}
    </div>
  )
}

export function Topology({
  stage,
  pulses = [],
  replayKey,
  highlightBox,
  className,
  atomicNodeId,
  atomicFlashDelaysMs,
  explodeNodeId,
}: {
  stage: TopologyStage
  pulses?: FlowPulse[]
  replayKey: string | number
  highlightBox?: HighlightBoxSpec
  className?: string
  /** Node id to draw spinning "atomic operation" orbit rings around. */
  atomicNodeId?: string
  /** When each pulse should land on `atomicNodeId`, in ms from mount — each one triggers a brief flash on the rings. */
  atomicFlashDelaysMs?: number[]
  /** Node id to play a one-shot mushroom-cloud explosion on top of, once mounted. */
  explodeNodeId?: string
}): ReactNode {
  const nodesById = new Map(stage.nodes.map((n) => [n.id, n]))
  const edgesById = new Map(stage.edges.map((e) => [e.id, e]))
  const canvasHeight = stage.height ?? CANVAS_HEIGHT
  const canvasWidth = stage.width ?? CANVAS_WIDTH

  return (
    <div className={`topo${className ? ` ${className}` : ''}`} style={{ height: canvasHeight, width: canvasWidth }} key={replayKey}>
      <svg className="topo__lines" width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
        {stage.edges.map((e) => (
          <path
            key={e.id}
            id={`topo-edge-${replayKey}-${e.id}`}
            d={edgePath(e, nodesById)}
            className={`topo__edge topo__edge--${e.style ?? 'solid'}${e.breaker === 'open' ? ' topo__edge--broken' : ''}`}
          />
        ))}
      </svg>
      {highlightBox && <HighlightBox spec={highlightBox} nodesById={nodesById} />}
      {atomicNodeId && <AtomicRings nodeId={atomicNodeId} nodesById={nodesById} flashDelaysMs={atomicFlashDelaysMs ?? []} />}
      {stage.nodes.map((n) => <Node key={n.id} node={n} />)}
      {stage.edges.map((e) => e.breaker && <BreakerIcon key={`breaker-${e.id}`} edge={e} nodesById={nodesById} />)}
      {explodeNodeId && <Explosion nodeId={explodeNodeId} nodesById={nodesById} />}
      {pulses.map((p) => {
        const e = edgesById.get(p.edgeId)
        if (!e || e.breaker === 'open') return null
        const variant = p.variant ?? 'request'
        return (
          <span
            key={p.id}
            className={`topo__pulse topo__pulse--${p.role ?? 'legit'} topo__pulse--${variant}${p.size ? ` topo__pulse--${p.size}` : ''}${p.timeout ? ' topo__pulse--timeout' : ''}${p.blocked ? ' topo__pulse--blocked' : ''}${p.once ? ' topo__pulse--once' : ''}`}
            style={{
              offsetPath: `path('${edgePath(e, nodesById, p.reverse)}')`,
              '--duration': `${p.durationMs ?? 900}ms`,
              '--delay': `${p.delayMs ?? 0}ms`,
              ...(p.arriveDistance ? { '--arrive-distance': p.arriveDistance } : {}),
            } as CSSProperties}
          >
            {p.face && <span className="topo__pulse-face">{p.face}</span>}
            {p.label && <em>{p.label}</em>}
          </span>
        )
      })}
    </div>
  )
}
