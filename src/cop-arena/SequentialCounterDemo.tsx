import type { FlowPulse } from './topology-model'
import { RemainingLog } from './RemainingLog'
import { useBallLogStream } from './shared'
import { NODE_HALF, HIGHLIGHT_PADDING, Topology } from './Topology'
import { sequentialCounterStage } from './topology-model'

// Fixed cadence/log-value pool for the "sequential test, zoomed into the counter"
// slide — every request lands (this beat is about bookkeeping overhead, not
// rejections), so all it drives is how fast the remaining-budget header ticks
// down, out of order, one line per landed request.
const BALL_INTERVAL_MS = 250
const BALL_TRAVEL_MS = 550
const MAX_LOG_ENTRIES = 24
const REMAINING_VALUES = ['98', '82', '96', '95', '94', '80', '76', '75', '91', '90', '88', '86']

const HIGHLIGHT_NODE_IDS = ['server', 'store']

export function SequentialCounterDemo() {
  const { ref, balls, entries } = useBallLogStream(true, {
    intervalMs: BALL_INTERVAL_MS,
    travelMs: BALL_TRAVEL_MS,
    values: REMAINING_VALUES,
    maxEntries: MAX_LOG_ENTRIES,
  })

  const stage = sequentialCounterStage({ storeHealth: 'ok' })
  const nodesById = new Map(stage.nodes.map((n) => [n.id, n]))
  const client = nodesById.get('client')!
  const server = nodesById.get('server')!

  // Balls travel from the leftmost box (client) and should disappear right at the
  // dashed highlight box's edge, not at the server node itself — so the arrival
  // point is expressed as a fraction of the client->server edge, derived from the
  // exact same geometry `Topology`'s `HighlightBox` uses to draw that dashed edge.
  const highlightLeftX = Math.min(...HIGHLIGHT_NODE_IDS.map((id) => nodesById.get(id)!.x)) - NODE_HALF - HIGHLIGHT_PADDING
  const arriveDistance = `${(((highlightLeftX - client.x) / (server.x - client.x)) * 100).toFixed(1)}%`

  const pulses: FlowPulse[] = balls.map((ball) => ({
    id: `seq-${ball.id}`,
    edgeId: 'client->server',
    once: true,
    durationMs: BALL_TRAVEL_MS,
    arriveDistance,
  }))

  return (
    <div className="cop-arena" ref={ref}>
      <div className="cop-arena__stage sequential-log-demo__stage">
        <Topology
          stage={stage}
          pulses={pulses}
          replayKey="sequential-log"
          highlightBox={{ nodeIds: HIGHLIGHT_NODE_IDS }}
          className="sequential-log-demo"
        />
        <RemainingLog entries={entries} />
      </div>
    </div>
  )
}
