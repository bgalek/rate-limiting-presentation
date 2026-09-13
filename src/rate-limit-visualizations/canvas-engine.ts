import {
  FloatingWindowLimiter,
  TokenBucketLimiter,
  UserFixedWindowLimiter,
  createRateLimiter,
  type RateLimitAlgorithm,
  type RateLimiter,
} from './algorithms'

const ALLOWED_COLOR = '#3bc9db'
const BLOCKED_COLOR = '#ffd43b'
const MUTED_COLOR = '#ced4da'
const TRACK_COLOR = '#adb5bd'
const WINDOW_COLOR = 'rgba(76, 110, 245, 0.24)'
const WINDOW_BORDER_COLOR = 'rgba(145, 167, 255, 0.28)'

export interface VisualizationConfig {
  algorithm: RateLimitAlgorithm
  limit: number
  windowMs: number
  refillIntervalMs: number
  refillRate: number
  autoPlay: boolean
  startPaused: boolean
  showBoundaryLabels: boolean
}

export interface RequestEvent {
  id: number
  timestamp: number
  allowed: boolean
}

export interface VisualizationSnapshot {
  allowed: number
  blocked: number
  remaining: number
  playing: boolean
  started: boolean
}

export interface VisualizationController {
  destroy(): void
  hit(): void
  setPlaying(playing: boolean): void
  start(): void
}

interface CanvasSize {
  width: number
  height: number
}

function easeOutElastic(value: number): number {
  const constant = (2 * Math.PI) / 3

  if (value === 0 || value === 1) {
    return value
  }

  return 2 ** (-10 * value) * Math.sin((value * 10 - 0.75) * constant) + 1
}

function easeOutExpo(value: number): number {
  return value === 1 ? 1 : 1 - 2 ** (-10 * value)
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

export class CanvasVisualizationEngine implements VisualizationController {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly getConfig: () => VisualizationConfig
  private readonly onSnapshot: (snapshot: VisualizationSnapshot) => void
  private readonly intersectionObserver: IntersectionObserver
  private readonly resizeObserver: ResizeObserver
  private animationFrame = 0
  private limiter: RateLimiter
  private limiterKey = ''
  private events: RequestEvent[] = []
  private nextEventId = 1
  private nextAutomaticHitAt = 0
  private intervalIndex = 0
  private playing = true
  private started = true
  private visible = true
  private lastSnapshotAt = 0

  public constructor(
    canvas: HTMLCanvasElement,
    getConfig: () => VisualizationConfig,
    onSnapshot: (snapshot: VisualizationSnapshot) => void,
  ) {
    const context = canvas.getContext('2d')

    if (context === null) {
      throw new Error('This browser does not support the 2D canvas API.')
    }

    this.canvas = canvas
    this.context = context
    this.getConfig = getConfig
    this.onSnapshot = onSnapshot
    this.limiter = createRateLimiter(
      getConfig().algorithm,
      getConfig(),
      performance.now(),
    )
    this.started = !getConfig().startPaused
    this.playing = getConfig().autoPlay
    this.frame = this.frame.bind(this)

    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this))
    this.resizeObserver.observe(canvas)
    this.intersectionObserver = new IntersectionObserver(
      this.handleIntersection.bind(this),
      { rootMargin: '160px' },
    )
    this.intersectionObserver.observe(canvas)
    this.nextAutomaticHitAt = performance.now() + 500
    this.emitSnapshot(performance.now())
    this.animationFrame = requestAnimationFrame(this.frame)
  }

  public destroy(): void {
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.intersectionObserver.disconnect()
  }

  public hit(): void {
    this.ensureLimiter(performance.now())
    this.attempt(performance.now())
    this.playing = false
    this.emitSnapshot(performance.now())
  }

  public setPlaying(playing: boolean): void {
    this.playing = playing
    this.started = true
    this.nextAutomaticHitAt = performance.now() + 350
    this.emitSnapshot(performance.now())
  }

  public start(): void {
    this.started = true
    this.playing = true
    this.nextAutomaticHitAt = performance.now() + 250
    this.emitSnapshot(performance.now())
  }

  private frame(now: number): void {
    this.ensureLimiter(now)

    if (this.visible) {
      this.maybeGenerateAutomaticHit(now)
      this.draw(now)

      if (now - this.lastSnapshotAt > 200) {
        this.emitSnapshot(now)
      }
    }

    this.animationFrame = requestAnimationFrame(this.frame)
  }

  private maybeGenerateAutomaticHit(now: number): void {
    if (!this.started || !this.playing || !this.getConfig().autoPlay) {
      return
    }

    if (now < this.nextAutomaticHitAt) {
      return
    }

    this.attempt(now)
    const intervals = [600, 600, 600, 1_800]
    this.nextAutomaticHitAt = now + intervals[this.intervalIndex]
    this.intervalIndex = (this.intervalIndex + 1) % intervals.length
  }

  private attempt(now: number): void {
    const result = this.limiter.attempt(now)

    this.events.push({
      id: this.nextEventId,
      timestamp: now,
      allowed: result.allowed,
    })
    this.nextEventId += 1
    this.events = this.events.filter(function keepVisibleEvent(event) {
      return event.timestamp > now - 40_000
    })
  }

  private ensureLimiter(now: number): void {
    const config = this.getConfig()
    const nextLimiterKey = [
      config.algorithm,
      config.limit,
      config.windowMs,
      config.refillIntervalMs,
      config.refillRate,
    ].join(':')

    if (nextLimiterKey === this.limiterKey) {
      return
    }

    this.limiterKey = nextLimiterKey
    this.limiter = createRateLimiter(config.algorithm, config, now)
    this.events = []
  }

  private draw(now: number): void {
    const size = this.prepareCanvas()
    const config = this.getConfig()

    this.context.clearRect(0, 0, size.width, size.height)
    this.context.font = '600 16px system-ui, sans-serif'

    switch (config.algorithm) {
      case 'fixed-window':
        this.drawFixedWindows(now, size)
        break
      case 'user-fixed-window':
        this.drawUserFixedWindow(now, size)
        break
      case 'sliding-window':
        this.drawSlidingWindow(now, size)
        break
      case 'floating-window':
        this.drawFloatingWindow(now, size)
        break
      case 'token-bucket':
        this.drawTokenBucket(now, size)
        break
    }

    this.drawEvents(now, size)
    this.drawNowAndRemaining(now, size)
  }

  private prepareCanvas(): CanvasSize {
    const rectangle = this.canvas.getBoundingClientRect()
    const width = Math.max(rectangle.width, 1)
    const height = Math.max(rectangle.height, 1)
    const ratio = window.devicePixelRatio || 1
    const pixelWidth = Math.round(width * ratio)
    const pixelHeight = Math.round(height * ratio)

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    return { width, height }
  }

  private drawFixedWindows(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const scale = this.windowScale()
    const currentWindowIndex = Math.floor(now / config.windowMs)

    for (let offset = -2; offset <= 2; offset += 1) {
      const windowStartedAt = (currentWindowIndex + offset) * config.windowMs
      const x = size.width / 2 + (windowStartedAt - now) * scale
      const width = config.windowMs * scale

      this.context.fillStyle = WINDOW_COLOR
      this.context.strokeStyle = WINDOW_BORDER_COLOR
      this.context.lineWidth = 1
      roundedRectangle(this.context, x, size.height / 2 - 29, width, 58, 9)
      this.context.fill()
      this.context.stroke()

      if (config.showBoundaryLabels) {
        this.drawBoundaryLabel(x)
      }
    }
  }

  private drawUserFixedWindow(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const scale = this.windowScale()
    const windowStartedAt =
      this.limiter instanceof UserFixedWindowLimiter
        ? this.limiter.getWindowStartedAt(now)
        : null

    this.drawDottedTrack(now, size)

    if (windowStartedAt === null) {
      return
    }

    const x = size.width / 2 + (windowStartedAt - now) * scale
    const width = config.windowMs * scale
    this.context.fillStyle = WINDOW_COLOR
    roundedRectangle(this.context, x, size.height / 2 - 29, width, 58, 9)
    this.context.fill()
  }

  private drawSlidingWindow(now: number, size: CanvasSize): void {
    const width = this.getConfig().windowMs * this.windowScale()
    this.drawDottedTrack(now, size)
    this.context.fillStyle = 'rgba(76, 110, 245, 0.24)'
    roundedRectangle(
      this.context,
      size.width / 2 - width,
      size.height / 2 - 29,
      width,
      58,
      9,
    )
    this.context.fill()
  }

  private drawFloatingWindow(now: number, size: CanvasSize): void {
    this.drawFixedWindows(now, size)
    const width = this.getConfig().windowMs * this.windowScale()
    const left = size.width / 2 - width

    this.context.strokeStyle = 'rgba(206, 212, 218, 0.48)'
    this.context.lineWidth = 2
    this.context.setLineDash([5, 4])
    roundedRectangle(
      this.context,
      left,
      size.height / 2 - 29,
      width,
      58,
      9,
    )
    this.context.stroke()
    this.context.setLineDash([])

    if (this.limiter instanceof FloatingWindowLimiter) {
      const snapshot = this.limiter.snapshot(now)
      const label = `~${snapshot.estimate.toFixed(1)} requests`
      this.context.fillStyle = MUTED_COLOR
      this.context.fillText(label, left + 12, size.height / 2 - 40)
    }
  }

  private drawTokenBucket(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const tokens =
      this.limiter instanceof TokenBucketLimiter
        ? Math.floor(this.limiter.tokenCount(now))
        : 0
    const bucketHeight = Math.min(config.limit * 11 + 10, size.height - 36)
    const bucketX = size.width - 48
    const bucketY = size.height / 2 - bucketHeight / 2

    this.drawDottedTrack(now, size)
    this.context.fillStyle = '#091627'
    this.context.strokeStyle = MUTED_COLOR
    this.context.lineWidth = 1
    roundedRectangle(this.context, bucketX, bucketY, 16, bucketHeight, 6)
    this.context.fill()
    this.context.stroke()
    this.context.fillRect(bucketX - 1, bucketY - 6, 18, 7)

    for (let tokenIndex = 0; tokenIndex < tokens; tokenIndex += 1) {
      this.context.fillStyle = ALLOWED_COLOR
      roundedRectangle(
        this.context,
        bucketX + 3,
        bucketY + bucketHeight - 12 - tokenIndex * 11,
        10,
        10,
        5,
      )
      this.context.fill()
    }
  }

  private drawDottedTrack(now: number, size: CanvasSize): void {
    const dotSpacing = 14
    const offset = (now * this.windowScale()) % dotSpacing

    this.context.globalAlpha = 0.52
    for (let x = -offset; x < size.width + dotSpacing; x += dotSpacing) {
      this.context.fillStyle = TRACK_COLOR
      roundedRectangle(this.context, x, size.height / 2 - 2, 4, 4, 2)
      this.context.fill()
    }
    this.context.globalAlpha = 1
  }

  private drawBoundaryLabel(x: number): void {
    this.context.fillStyle = MUTED_COLOR
    this.context.fillRect(x - 0.5, 0, 1, 24)
    this.context.fillText('midnight', x + 8, 19)
  }

  private drawEvents(now: number, size: CanvasSize): void {
    const centerX = size.width / 2
    const centerY = size.height / 2
    const scale = this.windowScale()

    for (const event of this.events) {
      const age = now - event.timestamp
      const x = centerX - age * scale

      if (x < -20 || x > size.width + 20) {
        continue
      }

      const animationProgress = Math.min(Math.max(age / 1_000, 0), 1)
      const radius = 5.5 * easeOutElastic(animationProgress)

      if (age < 1_000) {
        const pulseRadius = 13 * easeOutExpo(animationProgress)
        this.context.fillStyle = event.allowed ? ALLOWED_COLOR : BLOCKED_COLOR
        this.context.globalAlpha = Math.max(0.7 - animationProgress * 0.7, 0)
        roundedRectangle(
          this.context,
          x - pulseRadius,
          centerY - pulseRadius,
          pulseRadius * 2,
          pulseRadius * 2,
          pulseRadius,
        )
        this.context.fill()
        this.context.globalAlpha = 1
      }

      this.context.fillStyle = event.allowed ? ALLOWED_COLOR : BLOCKED_COLOR

      if (event.allowed) {
        roundedRectangle(
          this.context,
          x - radius,
          centerY - radius,
          radius * 2,
          radius * 2,
          radius,
        )
      } else {
        roundedRectangle(
          this.context,
          x - radius,
          centerY - 2,
          radius * 2,
          4,
          radius,
        )
      }

      this.context.fill()
    }
  }

  private drawNowAndRemaining(now: number, size: CanvasSize): void {
    const remaining = this.limiter.remaining(now)
    const formattedRemaining = Number.isInteger(remaining)
      ? remaining.toFixed(0)
      : remaining.toFixed(1)

    this.context.fillStyle = MUTED_COLOR
    this.context.fillRect(size.width / 2 - 6, size.height - 32, 1.5, 18)
    this.context.fillText('now', size.width / 2 + 7, size.height - 14)
    this.context.textAlign = 'right'
    this.context.fillText(
      `remaining = ${formattedRemaining}`,
      size.width - 22,
      size.height - 14,
    )
    this.context.textAlign = 'left'
  }

  private windowScale(): number {
    return 320 / this.getConfig().windowMs
  }

  private emitSnapshot(now: number): void {
    const allowed = this.events.filter(function countAllowed(event) {
      return event.allowed
    }).length
    const blocked = this.events.length - allowed

    this.lastSnapshotAt = now
    this.onSnapshot({
      allowed,
      blocked,
      remaining: this.limiter.remaining(now),
      playing: this.playing,
      started: this.started,
    })
  }

  private handleResize(): void {
    this.draw(performance.now())
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    this.visible = entries[0]?.isIntersecting ?? true
  }
}
