import { continuousFullPathPulses } from './race-simulation'
import { useOneShotWave } from './shared'
import { Topology } from './Topology'
import { lbFanStoreStage } from './topology-model'

// 15 lanes at a 60ms stagger tile exactly into `continuousFullPathPulses`'s 900ms
// cycle (15 * 60 = 900) — see that function for why that has to divide evenly.
const BALL_COUNT = 15
const EDGE_COUNT = 4
const STREAM_DURATION_MS = 4_000

/** A nonstop heavy stream hits an atomically-guarded store (the orbit rings) — until,
 * a few seconds in, the store itself blows up: the stream cuts off dead and a
 * mushroom-cloud explosion plays out over the store, settling into a dead, empty
 * slide once it's done. Atomicity only protects the bookkeeping; a single shared
 * store is still a single point of failure. */
export function DbFailureDemo() {
  const { ref, wave, settled: exploded } = useOneShotWave(true, STREAM_DURATION_MS)

  const stage = lbFanStoreStage({ storeHealth: exploded ? 'down' : 'ok' })
  const pulses = exploded ? [] : continuousFullPathPulses(BALL_COUNT, EDGE_COUNT)

  return (
    <div className="cop-arena" ref={ref}>
      <div className="cop-arena__stage">
        <Topology
          stage={stage}
          pulses={pulses}
          replayKey={wave}
          atomicNodeId={exploded ? undefined : 'store'}
          explodeNodeId={exploded ? 'store' : undefined}
        />
      </div>
    </div>
  )
}
