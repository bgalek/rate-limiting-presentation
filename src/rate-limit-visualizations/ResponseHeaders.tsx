import type { VisualizationSnapshot } from './canvas-engine'

export interface ResponseHeadersProps {
  snapshot: VisualizationSnapshot | null
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function formatSeconds(ms: number): string {
  return `${Math.ceil(ms / 1_000)}s`
}

export default function ResponseHeaders({ snapshot }: ResponseHeadersProps) {
  const blocked = snapshot?.lastAllowed === false

  return (
    <div className="response-headers">
      <div className="response-headers__status" data-blocked={blocked || undefined}>
        {blocked ? '429 Too Many Requests' : '200 OK'}
      </div>
      <div className="response-headers__row">
        <span>X-RateLimit-Limit</span>
        <strong>{snapshot ? snapshot.limit : '—'}</strong>
      </div>
      <div className="response-headers__row">
        <span>X-RateLimit-Remaining</span>
        <strong>{snapshot ? formatCount(snapshot.remaining) : '—'}</strong>
      </div>
      <div className="response-headers__row">
        <span>X-RateLimit-Reset</span>
        <strong>{snapshot && snapshot.resetMs > 0 ? formatSeconds(snapshot.resetMs) : '—'}</strong>
      </div>
      <div className="response-headers__row response-headers__row--retry" data-active={blocked || undefined}>
        <span>Retry-After</span>
        <strong>{blocked && snapshot ? formatSeconds(snapshot.retryAfterMs) : '—'}</strong>
      </div>
    </div>
  )
}
