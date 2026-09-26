export type RateLimitKeyTagProps = {
  value: string
  changed?: boolean
  label?: string
  /** 'alert' tints the pill and value a warning color — e.g. traffic arriving above the configured limit. */
  tone?: 'neutral' | 'alert'
}

export function RateLimitKeyTag({ value, changed, label = 'key', tone = 'neutral' }: RateLimitKeyTagProps) {
  return (
    <div className={`key-tag${changed ? ' key-tag--changed' : ''}${tone === 'alert' ? ' key-tag--alert' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
