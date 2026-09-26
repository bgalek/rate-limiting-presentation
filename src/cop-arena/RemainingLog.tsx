import type { LogEntry } from './shared'

/** Chat-window-style scroll of logged header values — newest at the bottom, oldest
 * clipped off the top once the panel fills up. */
export function RemainingLog({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="remaining-log">
      <div className="remaining-log__header">X-RateLimit-Remaining</div>
      <div className="remaining-log__lines">
        {entries.map((entry) => (
          <div key={entry.id} className="remaining-log__line">X-RateLimit-Remaining: <strong>{entry.value}</strong></div>
        ))}
      </div>
    </div>
  )
}
