// Thin wrapper around the existing `.budget-orbit` styling (shared with
// `AlgorithmsDeck.tsx`'s `WeightedCostDemo`) — no new CSS.
import type { CSSProperties } from 'react'

export function TokenBudget({ remaining, max }: { remaining: number; max: number }) {
  const percent = Math.max(0, Math.min(100, (remaining / max) * 100))
  return (
    <div className="budget-orbit" style={{ '--remaining': `${percent}%` } as CSSProperties}>
      <strong>{remaining}</strong><span>tokens/min</span>
    </div>
  )
}
