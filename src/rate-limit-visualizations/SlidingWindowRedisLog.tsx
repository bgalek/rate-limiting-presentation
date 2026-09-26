import type { VisualizationSnapshot } from './canvas-engine'

export interface SlidingWindowRedisLogProps {
  snapshot: VisualizationSnapshot | null
}

function formatMember(epochMs: number): string {
  return (epochMs / 1_000).toFixed(2)
}

export default function SlidingWindowRedisLog({ snapshot }: SlidingWindowRedisLogProps) {
  const entries = snapshot?.slidingWindowLog ?? []
  const limit = snapshot?.limit ?? 0
  const stored = entries.filter((entry) => entry.state !== 'rejected')
  const count = stored.filter((entry) => entry.state === 'stored').length
  const full = count >= limit && limit > 0

  return (
    <div className="redis-log">
      <div className="redis-log__header">
        <span>Redis</span>
        <strong>ZSET rl:client</strong>
      </div>
      <div className="redis-log__meter">
        <span
          className="redis-log__meter-fill"
          data-full={full || undefined}
          style={{ width: limit > 0 ? `${Math.min((count / limit) * 100, 100)}%` : '0%' }}
        />
      </div>
      <div className="redis-log__rows">
        {stored.length === 0 && <p className="redis-log__empty">no members yet</p>}
        {stored.map((entry) => (
          <div
            key={entry.id}
            className="redis-log__row"
            data-evicting={entry.state === 'evicting' || undefined}
          >
            <span className="redis-log__op">{entry.state === 'evicting' ? 'ZREM' : 'ZADD'}</span>
            <span className="redis-log__member">{formatMember(entry.timestamp)}</span>
          </div>
        ))}
      </div>
      {entries.some((entry) => entry.state === 'rejected') && (
        <p className="redis-log__reject-flash">ZCARD rl:client → {limit} ≥ limit · 429</p>
      )}
    </div>
  )
}
