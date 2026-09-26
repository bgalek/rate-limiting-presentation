// Numeric model behind every load/backend number shown in the Cop Arena decks.
// Every percentage on screen is `loadPercent(demand, capacity)` against one of the
// named capacities below — never a hand-picked number — so a viewer could re-derive
// it from what's stated on screen (the per-beat `demand` captions state the volume).

// Scaled convention (matches MainDeck.tsx's `IdentityDemo`/`WindowBoundaryDemo`):
// 6 req / 6s stands in for the dialogue's "100 req/min", so these arena canvases
// visually match the main talk's canvases (same limit/window ratio).
export const LEGIT_LIMIT = 6
export const LEGIT_WINDOW_MS = 6_000
export const LEGIT_RPS = LEGIT_LIMIT / (LEGIT_WINDOW_MS / 1_000) // 1 req/s baseline

// Capacity ceilings, one per resource axis — chosen so baseline legit traffic sits
// at a calm ~5-20% and each scenario's derived load is a genuine function of its
// stated volume, not a hand-picked number.
export const WEB_CAPACITY_RPS = 150 // requests/sec before the edge tier is saturated
export const DB_CAPACITY_UNITS_PER_S = 9 // "db-cost units/sec" before the database is saturated
export const STORE_CAPACITY_OPS_PER_S = 20_000 // atomic-check ops/sec a single-threaded store can do

// A system doing nothing still shows a faint pulse on a gauge — never a literal 0%.
export const BASELINE_LOAD_PERCENT = 8

export function loadPercent(demandPerSec: number, capacityPerSec: number): number {
  return Math.min(100, Math.round((demandPerSec / capacityPerSec) * 100))
}
