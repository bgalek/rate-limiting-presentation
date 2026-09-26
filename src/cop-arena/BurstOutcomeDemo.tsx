import { RateLimitKeyTag } from './RateLimitKeyTag'
import { burstArrivalTimesMs, burstRequestPulses, burstWaveDurationMs } from './race-simulation'
import { Scoreboard, useOneShotWave } from './shared'
import { Topology } from './Topology'
import { lbFanStoreStage } from './topology-model'

// Same 200-concurrent-requests burst as the beat it follows, drawn as this many
// sample balls fanning across this many edge servers before landing on the store —
// the request count in the scoreboard below is the narrative total, not literally
// how many balls are on screen (same abstraction `fanRequestPulses` already uses).
const BALL_COUNT = 16
const EDGE_COUNT = 4
const SETTLE_BUFFER_MS = 300

export type BurstOutcomeDemoProps = {
  /** Draws spinning "atomic operation" rings around the store and flashes them on each landing, instead of leaving it a plain node. */
  atomic?: boolean
  admitted: number
  rejected: number
}

export function BurstOutcomeDemo({ atomic = false, admitted, rejected }: BurstOutcomeDemoProps) {
  const { ref, wave, settled } = useOneShotWave(true, burstWaveDurationMs(BALL_COUNT) + SETTLE_BUFFER_MS)

  const stage = lbFanStoreStage({ storeHealth: 'ok' })
  const pulses = burstRequestPulses(BALL_COUNT, EDGE_COUNT)

  return (
    <div className="cop-arena" ref={ref}>
      <div className="cop-arena__header">
        <div className="burst-outcome-demo__badges">
          <RateLimitKeyTag label="rate limit" value="100 req/s" />
          <RateLimitKeyTag label="incoming" value="200 req/s" tone="alert" />
        </div>
      </div>
      <div className="cop-arena__stage">
        <Topology
          stage={stage}
          pulses={pulses}
          replayKey={wave}
          atomicNodeId={atomic ? 'store' : undefined}
          atomicFlashDelaysMs={atomic ? burstArrivalTimesMs(BALL_COUNT) : undefined}
        />
      </div>
      <div className="cop-arena__footer">
        {settled && <Scoreboard ok={String(admitted)} rejected={String(rejected)} />}
      </div>
    </div>
  )
}
