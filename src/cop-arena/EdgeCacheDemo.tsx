import { edgeSyncPulses, fanRequestPulses } from './race-simulation'
import { Topology } from './Topology'
import { lbFanStoreStage } from './topology-model'

const BALL_COUNT = 16
const EDGE_COUNT = 4

/** Each edge server now keeps its own local copy of the store (the corner badge) —
 * request traffic is served straight off that copy and never needs the central store,
 * so it always stops at the edge. A slow, separate heartbeat (one green ball, one edge
 * at a time, once a second) keeps those local copies in sync in the background. */
export function EdgeCacheDemo() {
  const stage = lbFanStoreStage({ storeHealth: 'ok' })
  const cachedStage = {
    ...stage,
    nodes: stage.nodes.map((n) => (n.id.startsWith('edge-') ? { ...n, cornerBadge: true } : n)),
  }
  const pulses = [...fanRequestPulses(BALL_COUNT, EDGE_COUNT), ...edgeSyncPulses(EDGE_COUNT)]

  return (
    <div className="cop-arena">
      <div className="cop-arena__stage">
        <Topology stage={cachedStage} pulses={pulses} replayKey="edge-cache" />
      </div>
    </div>
  )
}
