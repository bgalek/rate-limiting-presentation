import type { VisualizationSnapshot } from './canvas-engine'

export interface FloatingWindowRedisStoreProps {
  snapshot: VisualizationSnapshot | null
}

export default function FloatingWindowRedisStore({ snapshot }: FloatingWindowRedisStoreProps) {
  const floatingWindow = snapshot?.floatingWindow
  const ttlSeconds = snapshot ? Math.ceil(snapshot.resetMs / 1_000) : null

  return (
    <div className="redis-log">
      <div className="redis-log__header">
        <span>Redis</span>
      </div>
      <div className="redis-counter-rows">
        <div className="redis-counter-row">
          <span className="redis-counter-row__op">INCR</span>
          <span className="redis-counter-row__member">rl:client:curr = {floatingWindow ? floatingWindow.currentWindowCount : '—'}</span>
          <span className="redis-counter-row__ttl">{ttlSeconds !== null ? `TTL ${ttlSeconds}s` : '—'}</span>
        </div>
        <div className="redis-counter-row">
          <span className="redis-counter-row__op">GET</span>
          <span className="redis-counter-row__member">rl:client:prev = {floatingWindow ? floatingWindow.previousWindowCount : '—'}</span>
          <span className="redis-counter-row__ttl">carries {floatingWindow ? `${(floatingWindow.previousWindowWeight * 100).toFixed(0)}%` : '—'}</span>
        </div>
      </div>
    </div>
  )
}
