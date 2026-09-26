// Sibling to `rate-limit-visualizations/ResponseHeaders.tsx`, reusing its exact
// `.response-headers*` CSS so it's visually indistinguishable from the "real"
// canvas-driven header strip — but driven by plain scripted values, since most
// cop-arena beats aren't literal single-key canvas simulations.
export type HeaderStripProps = {
  status: number | 'DOWN'
  limit: number | string
  remaining: number | string
  resetLabel?: string
  retryAfterLabel?: string
  /** Cycles `remaining` through these values — used for the one beat with out-of-order headers. */
  sequence?: string[]
}

function statusLabel(status: HeaderStripProps['status']): string {
  if (status === 'DOWN') return 'connection refused'
  if (status === 200) return '200 OK'
  if (status === 429) return '429 Too Many Requests'
  if (status === 503) return '503 Service Unavailable'
  return String(status)
}

export function HeaderStrip({ status, limit, remaining, resetLabel = '—', retryAfterLabel, sequence }: HeaderStripProps) {
  const blocked = status !== 200
  return (
    <div className="response-headers">
      <div className="response-headers__status" data-blocked={blocked || undefined}>{statusLabel(status)}</div>
      <div className="response-headers__row">
        <span>X-RateLimit-Limit</span>
        <strong>{limit}</strong>
      </div>
      <div className="response-headers__row">
        <span>X-RateLimit-Remaining</span>
        {sequence ? (
          <strong className="header-strip__sequence">{sequence.map((v, i) => <span key={i}>{v}</span>)}</strong>
        ) : (
          <strong>{remaining}</strong>
        )}
      </div>
      <div className="response-headers__row">
        <span>X-RateLimit-Reset</span>
        <strong>{resetLabel}</strong>
      </div>
      <div className="response-headers__row response-headers__row--retry" data-active={blocked || undefined}>
        <span>Retry-After</span>
        <strong>{blocked && retryAfterLabel ? retryAfterLabel : '—'}</strong>
      </div>
    </div>
  )
}
