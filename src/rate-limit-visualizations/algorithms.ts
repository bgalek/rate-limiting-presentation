export type RateLimitAlgorithm =
  | 'fixed-window'
  | 'user-fixed-window'
  | 'sliding-window'
  | 'floating-window'
  | 'token-bucket'
  | 'leaky-bucket'

export interface RateLimitOptions {
  limit: number
  windowMs: number
  refillIntervalMs: number
  refillRate: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export interface RateLimiter {
  attempt(now: number): RateLimitResult
  remaining(now: number): number
}

function positiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.floor(value))
}

export class FixedWindowLimiter implements RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private windowIndex = Number.NaN
  private count = 0

  public constructor(options: RateLimitOptions) {
    this.limit = positiveInteger(options.limit, 1)
    this.windowMs = positiveInteger(options.windowMs, 8_000)
  }

  public attempt(now: number): RateLimitResult {
    this.refresh(now)
    const allowed = this.count < this.limit

    if (allowed) {
      this.count += 1
    }

    return {
      allowed,
      remaining: Math.max(this.limit - this.count, 0),
      retryAfterMs: allowed ? 0 : this.windowMs - (now % this.windowMs),
    }
  }

  public remaining(now: number): number {
    this.refresh(now)
    return Math.max(this.limit - this.count, 0)
  }

  private refresh(now: number): void {
    const nextWindowIndex = Math.floor(now / this.windowMs)

    if (nextWindowIndex !== this.windowIndex) {
      this.windowIndex = nextWindowIndex
      this.count = 0
    }
  }
}

export class UserFixedWindowLimiter implements RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private windowStartedAt: number | null = null
  private count = 0

  public constructor(options: RateLimitOptions) {
    this.limit = positiveInteger(options.limit, 1)
    this.windowMs = positiveInteger(options.windowMs, 8_000)
  }

  public attempt(now: number): RateLimitResult {
    this.refresh(now)

    if (this.windowStartedAt === null) {
      this.windowStartedAt = now
    }

    const allowed = this.count < this.limit

    if (allowed) {
      this.count += 1
    }

    return {
      allowed,
      remaining: Math.max(this.limit - this.count, 0),
      retryAfterMs:
        allowed || this.windowStartedAt === null
          ? 0
          : this.windowStartedAt + this.windowMs - now,
    }
  }

  public remaining(now: number): number {
    this.refresh(now)
    return Math.max(this.limit - this.count, 0)
  }

  public getWindowStartedAt(now: number): number | null {
    this.refresh(now)
    return this.windowStartedAt
  }

  private refresh(now: number): void {
    if (
      this.windowStartedAt !== null &&
      now >= this.windowStartedAt + this.windowMs
    ) {
      this.windowStartedAt = null
      this.count = 0
    }
  }
}

export class SlidingWindowLimiter implements RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private timestamps: number[] = []

  public constructor(options: RateLimitOptions) {
    this.limit = positiveInteger(options.limit, 1)
    this.windowMs = positiveInteger(options.windowMs, 8_000)
  }

  public attempt(now: number): RateLimitResult {
    this.refresh(now)
    const allowed = this.timestamps.length < this.limit

    if (allowed) {
      this.timestamps.push(now)
    }

    return {
      allowed,
      remaining: Math.max(this.limit - this.timestamps.length, 0),
      retryAfterMs:
        allowed || this.timestamps.length === 0
          ? 0
          : Math.max(this.timestamps[0] + this.windowMs - now, 0),
    }
  }

  public remaining(now: number): number {
    this.refresh(now)
    return Math.max(this.limit - this.timestamps.length, 0)
  }

  public count(now: number): number {
    this.refresh(now)
    return this.timestamps.length
  }

  private refresh(now: number): void {
    const cutoff = now - this.windowMs
    const firstRelevantIndex = this.timestamps.findIndex(
      function findRelevantTimestamp(timestamp) {
        return timestamp > cutoff
      },
    )

    if (firstRelevantIndex === -1) {
      this.timestamps = []
    } else if (firstRelevantIndex > 0) {
      this.timestamps = this.timestamps.slice(firstRelevantIndex)
    }
  }
}

export interface FloatingWindowSnapshot {
  estimate: number
  previousWindowCount: number
  currentWindowCount: number
  previousWindowWeight: number
}

export class FloatingWindowLimiter implements RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private allowedTimestamps: number[] = []

  public constructor(options: RateLimitOptions) {
    this.limit = positiveInteger(options.limit, 1)
    this.windowMs = positiveInteger(options.windowMs, 8_000)
  }

  public attempt(now: number): RateLimitResult {
    this.refresh(now)
    const allowed = Math.round(this.snapshot(now).estimate) < this.limit

    if (allowed) {
      this.allowedTimestamps.push(now)
    }

    const estimate = this.snapshot(now).estimate

    return {
      allowed,
      remaining: Math.max(this.limit - estimate, 0),
      retryAfterMs: allowed ? 0 : this.windowMs - (now % this.windowMs),
    }
  }

  public remaining(now: number): number {
    this.refresh(now)
    return Math.max(this.limit - this.snapshot(now).estimate, 0)
  }

  public snapshot(now: number): FloatingWindowSnapshot {
    const currentWindowIndex = Math.floor(now / this.windowMs)
    const currentWindowStartedAt = currentWindowIndex * this.windowMs
    const elapsedWeight = (now - currentWindowStartedAt) / this.windowMs
    let currentWindowCount = 0
    let previousWindowCount = 0

    for (const timestamp of this.allowedTimestamps) {
      const timestampWindowIndex = Math.floor(timestamp / this.windowMs)

      if (timestampWindowIndex === currentWindowIndex) {
        currentWindowCount += 1
      } else if (timestampWindowIndex === currentWindowIndex - 1) {
        previousWindowCount += 1
      }
    }

    const previousWindowWeight = 1 - elapsedWeight

    return {
      estimate:
        currentWindowCount + previousWindowCount * previousWindowWeight,
      previousWindowCount,
      currentWindowCount,
      previousWindowWeight,
    }
  }

  private refresh(now: number): void {
    const cutoff = now - this.windowMs * 2
    this.allowedTimestamps = this.allowedTimestamps.filter(
      function keepRecentTimestamp(timestamp) {
        return timestamp > cutoff
      },
    )
  }
}

export interface TokenBucketSnapshot {
  tokens: number
  capacity: number
  refillIntervalMs: number
  refillRate: number
  msSinceRefill: number
}

export class TokenBucketLimiter implements RateLimiter {
  private readonly capacity: number
  private readonly refillIntervalMs: number
  private readonly refillRate: number
  private tokens: number
  private lastRefilledAt: number

  public constructor(options: RateLimitOptions, now: number) {
    this.capacity = positiveInteger(options.limit, 1)
    this.refillIntervalMs = Math.max(options.refillIntervalMs, 1)
    this.refillRate = positiveInteger(options.refillRate, 1)
    this.tokens = this.capacity
    this.lastRefilledAt = now
  }

  public attempt(now: number): RateLimitResult {
    this.refill(now)
    const allowed = this.tokens >= 1

    if (allowed) {
      this.tokens -= 1
    }

    return {
      allowed,
      remaining: Math.floor(this.tokens),
      retryAfterMs: allowed
        ? 0
        : Math.max(this.lastRefilledAt + this.refillIntervalMs - now, 0),
    }
  }

  public remaining(now: number): number {
    this.refill(now)
    return Math.floor(this.tokens)
  }

  public tokenCount(now: number): number {
    this.refill(now)
    return this.tokens
  }

  public snapshot(now: number): TokenBucketSnapshot {
    this.refill(now)

    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillIntervalMs: this.refillIntervalMs,
      refillRate: this.refillRate,
      msSinceRefill: now - this.lastRefilledAt,
    }
  }

  private refill(now: number): void {
    const elapsed = now - this.lastRefilledAt

    if (elapsed < this.refillIntervalMs) {
      return
    }

    const intervals = Math.floor(elapsed / this.refillIntervalMs)
    this.tokens = Math.min(
      this.capacity,
      this.tokens + intervals * this.refillRate,
    )
    this.lastRefilledAt += intervals * this.refillIntervalMs
  }
}

export interface LeakyBucketSnapshot {
  capacity: number
  queueDepth: number
  drainIntervalMs: number
  drainRate: number
  msSinceDrain: number
}

export class LeakyBucketLimiter implements RateLimiter {
  private readonly capacity: number
  private readonly drainIntervalMs: number
  private readonly drainRate: number
  private queueDepth = 0
  private lastDrainedAt: number

  public constructor(options: RateLimitOptions, now: number) {
    this.capacity = positiveInteger(options.limit, 1)
    this.drainIntervalMs = Math.max(options.refillIntervalMs, 1)
    this.drainRate = positiveInteger(options.refillRate, 1)
    this.lastDrainedAt = now
  }

  public attempt(now: number): RateLimitResult {
    this.drain(now)
    const allowed = this.queueDepth < this.capacity

    if (allowed) {
      this.queueDepth += 1
    }

    return {
      allowed,
      remaining: Math.max(this.capacity - this.queueDepth, 0),
      retryAfterMs: allowed
        ? 0
        : Math.max(this.lastDrainedAt + this.drainIntervalMs - now, 0),
    }
  }

  public remaining(now: number): number {
    this.drain(now)
    return Math.max(this.capacity - this.queueDepth, 0)
  }

  public snapshot(now: number): LeakyBucketSnapshot {
    this.drain(now)

    return {
      capacity: this.capacity,
      queueDepth: this.queueDepth,
      drainIntervalMs: this.drainIntervalMs,
      drainRate: this.drainRate,
      msSinceDrain: now - this.lastDrainedAt,
    }
  }

  private drain(now: number): void {
    const elapsed = now - this.lastDrainedAt

    if (elapsed < this.drainIntervalMs) {
      return
    }

    const intervals = Math.floor(elapsed / this.drainIntervalMs)
    this.queueDepth = Math.max(0, this.queueDepth - intervals * this.drainRate)
    this.lastDrainedAt += intervals * this.drainIntervalMs
  }
}

export function createRateLimiter(
  algorithm: RateLimitAlgorithm,
  options: RateLimitOptions,
  now: number,
): RateLimiter {
  switch (algorithm) {
    case 'fixed-window':
      return new FixedWindowLimiter(options)
    case 'user-fixed-window':
      return new UserFixedWindowLimiter(options)
    case 'sliding-window':
      return new SlidingWindowLimiter(options)
    case 'floating-window':
      return new FloatingWindowLimiter(options)
    case 'token-bucket':
      return new TokenBucketLimiter(options, now)
    case 'leaky-bucket':
      return new LeakyBucketLimiter(options, now)
  }
}
