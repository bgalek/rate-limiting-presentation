import {
  FloatingWindowLimiter,
  LeakyBucketLimiter,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  UserFixedWindowLimiter,
  createRateLimiter,
  type FloatingWindowSnapshot,
  type RateLimitAlgorithm,
  type RateLimitResult,
  type RateLimiter,
} from './algorithms'

const ALLOWED_COLOR = '#3bc9db'
const BLOCKED_COLOR = '#ffd43b'
const MUTED_COLOR = '#ced4da'
const TRACK_COLOR = '#adb5bd'
const WINDOW_COLOR = 'rgba(76, 110, 245, 0.24)'
const WINDOW_BORDER_COLOR = 'rgba(145, 167, 255, 0.28)'
const BALL_FALL_DURATION_MS = 380
const BALL_LEAVE_DURATION_MS = 260
const REJECT_BUZZ_DURATION_MS = 420
const EVICTION_POP_DURATION_MS = 500

export interface VisualizationConfig {
  algorithm: RateLimitAlgorithm
  limit: number
  windowMs: number
  refillIntervalMs: number
  refillRate: number
  burstMode: boolean
  steadyMode: boolean
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
  limit: number
  resetMs: number
  retryAfterMs: number
  lastAllowed: boolean | null
  playing: boolean
  started: boolean
  stopped: boolean
  floatingWindow?: FloatingWindowSnapshot
}

export interface VisualizationController {
  destroy(): void
  hit(): void
  setPlaying(playing: boolean): void
  setStopped(stopped: boolean): void
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

function easeOutSoftBack(value: number): number {
  const overshoot = 1.15
  const shifted = value - 1

  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2
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

interface PailGeometry {
  centerX: number
  topY: number
  bottomY: number
  topHalfWidth: number
  bottomHalfWidth: number
}

function drawPail(context: CanvasRenderingContext2D, geometry: PailGeometry): void {
  const { centerX, topY, bottomY, topHalfWidth, bottomHalfWidth } = geometry
  const cornerRadius = 10

  const bodyGradient = context.createLinearGradient(
    centerX - topHalfWidth,
    0,
    centerX + topHalfWidth,
    0,
  )
  bodyGradient.addColorStop(0, '#0c1a2b')
  bodyGradient.addColorStop(0.45, '#16283d')
  bodyGradient.addColorStop(0.55, '#16283d')
  bodyGradient.addColorStop(1, '#0a1622')

  context.beginPath()
  context.moveTo(centerX - topHalfWidth, topY)
  context.lineTo(centerX - bottomHalfWidth, bottomY - cornerRadius)
  context.quadraticCurveTo(centerX - bottomHalfWidth, bottomY, centerX - bottomHalfWidth + cornerRadius, bottomY)
  context.lineTo(centerX + bottomHalfWidth - cornerRadius, bottomY)
  context.quadraticCurveTo(centerX + bottomHalfWidth, bottomY, centerX + bottomHalfWidth, bottomY - cornerRadius)
  context.lineTo(centerX + topHalfWidth, topY)
  context.closePath()
  context.fillStyle = bodyGradient
  context.fill()
  context.strokeStyle = 'rgba(206, 212, 218, 0.55)'
  context.lineWidth = 3
  context.stroke()

  context.beginPath()
  context.ellipse(centerX, topY, topHalfWidth, 8, 0, 0, Math.PI * 2)
  context.fillStyle = '#050b12'
  context.fill()
  context.strokeStyle = 'rgba(206, 212, 218, 0.7)'
  context.lineWidth = 3
  context.stroke()

  context.beginPath()
  context.ellipse(centerX, topY - 14, topHalfWidth * 0.85, 12, 0, Math.PI, Math.PI * 2)
  context.strokeStyle = 'rgba(206, 212, 218, 0.55)'
  context.lineWidth = 4
  context.stroke()
}

function drawBall(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  const gradient = context.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    radius * 0.15,
    x,
    y,
    radius,
  )
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.35, color)
  gradient.addColorStop(1, color)

  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = gradient
  context.fill()
}

function drawEmptySlot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.strokeStyle = 'rgba(173, 181, 189, 0.35)'
  context.lineWidth = 2
  context.setLineDash([3, 3])
  context.stroke()
  context.setLineDash([])
}

function drawClock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  progress: number,
  accentColor: string,
): void {
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + Math.PI * 2 * Math.min(Math.max(progress, 0), 1)

  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.strokeStyle = 'rgba(206, 212, 218, 0.35)'
  context.lineWidth = 2
  context.stroke()

  context.beginPath()
  context.arc(x, y, radius, startAngle, endAngle)
  context.strokeStyle = accentColor
  context.lineWidth = 2
  context.lineCap = 'round'
  context.stroke()
  context.lineCap = 'butt'

  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x + Math.cos(endAngle) * radius * 0.72, y + Math.sin(endAngle) * radius * 0.72)
  context.strokeStyle = accentColor
  context.lineWidth = 1.5
  context.stroke()

  context.beginPath()
  context.arc(x, y, 1.4, 0, Math.PI * 2)
  context.fillStyle = accentColor
  context.fill()
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
  private stopped = false
  private visible = true
  private lastSnapshotAt = 0
  private lastTokenCount = -1
  private tokenFallStarts = new Map<number, number>()
  private tokenLeaveStarts = new Map<number, number>()
  private lastQueueDepth = -1
  private queueFallStarts = new Map<number, number>()
  private fixedWindowRemaining = new Map<number, number>()
  private evictedEventIds = new Set<number>()
  private evictionPopStarts = new Map<number, number>()
  private virtualNow = 0
  private lastRealTime = 0
  private lastResult: RateLimitResult | null = null

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
    this.virtualNow = performance.now()
    this.lastRealTime = this.virtualNow
    this.limiter = createRateLimiter(
      getConfig().algorithm,
      getConfig(),
      this.virtualNow,
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
    this.nextAutomaticHitAt = this.virtualNow + 500
    this.emitSnapshot(this.virtualNow)
    this.animationFrame = requestAnimationFrame(this.frame)
  }

  public destroy(): void {
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.intersectionObserver.disconnect()
  }

  public hit(): void {
    this.ensureLimiter(this.virtualNow)
    this.attempt(this.virtualNow)
    this.playing = false
    this.emitSnapshot(this.virtualNow)
  }

  public setPlaying(playing: boolean): void {
    this.playing = playing
    this.started = true
    this.nextAutomaticHitAt = this.virtualNow + 350
    this.emitSnapshot(this.virtualNow)
  }

  public setStopped(stopped: boolean): void {
    this.stopped = stopped
    this.emitSnapshot(this.virtualNow)
  }

  public start(): void {
    this.started = true
    this.playing = true
    this.nextAutomaticHitAt = this.virtualNow + 250
    this.emitSnapshot(this.virtualNow)
  }

  private frame(realNow: number): void {
    const delta = this.lastRealTime === 0 ? 0 : realNow - this.lastRealTime
    this.lastRealTime = realNow

    if (!this.stopped) {
      this.virtualNow += delta
    }

    const now = this.virtualNow

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
    const intervals = this.getConfig().burstMode
      ? [70, 70, 70, 90, 120]
      : this.getConfig().steadyMode
        ? [320, 320, 320, 320]
        : [600, 600, 600, 1_800]
    this.nextAutomaticHitAt = now + intervals[this.intervalIndex]
    this.intervalIndex = (this.intervalIndex + 1) % intervals.length
  }

  private attempt(now: number): void {
    const result = this.limiter.attempt(now)
    this.lastResult = result

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
    this.lastResult = null
    this.lastTokenCount = -1
    this.tokenFallStarts.clear()
    this.tokenLeaveStarts.clear()
    this.lastQueueDepth = -1
    this.queueFallStarts.clear()
    this.evictedEventIds.clear()
    this.evictionPopStarts.clear()
  }

  private draw(now: number): void {
    const size = this.prepareCanvas()
    const config = this.getConfig()

    this.context.clearRect(0, 0, size.width, size.height)
    this.context.font = '600 16px system-ui, sans-serif'

    switch (config.algorithm) {
      case 'fixed-window':
        this.drawFixedWindows(now, size)
        this.drawFixedWindowRemainingLabels(now, size)
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
      case 'leaky-bucket':
        this.drawLeakyBucket(now, size)
        break
    }

    this.drawKeyLabel(now, size)
    this.drawNowLine(size)
    this.drawEvents(now, size)
    this.drawNowAndRemaining(now, size)
  }

  private drawKeyLabel(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const windowIndex = Math.floor(now / config.windowMs)
    const identity = '203.0.113.7'
    const keysByAlgorithm: Record<RateLimitAlgorithm, string> = {
      'fixed-window': `rl:${identity}:${windowIndex}`,
      'user-fixed-window': `rl:${identity}:${windowIndex}`,
      'sliding-window': `rl:${identity}:log`,
      'floating-window': `rl:${identity}:${windowIndex} (+ prev window's key)`,
      'token-bucket': `rl:${identity}:bucket`,
      'leaky-bucket': `rl:${identity}:queue`,
    }

    this.context.font = '600 12px ui-monospace, monospace'
    this.context.fillStyle = MUTED_COLOR
    this.context.textAlign = 'left'
    this.context.fillText(`key  ${keysByAlgorithm[config.algorithm]}`, 14, 20)
    this.context.font = '600 16px system-ui, sans-serif'
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

  private drawFixedWindowRemainingLabels(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const scale = this.windowScale()
    const currentWindowIndex = Math.floor(now / config.windowMs)

    this.fixedWindowRemaining.set(currentWindowIndex, this.limiter.remaining(now))

    for (const windowIndex of this.fixedWindowRemaining.keys()) {
      if (windowIndex < currentWindowIndex - 10 || windowIndex > currentWindowIndex + 10) {
        this.fixedWindowRemaining.delete(windowIndex)
      }
    }

    this.context.font = '600 12px ui-monospace, monospace'
    this.context.textAlign = 'center'

    for (let offset = -2; offset <= 2; offset += 1) {
      const windowIndex = currentWindowIndex + offset
      const windowStartedAt = windowIndex * config.windowMs
      const x = size.width / 2 + (windowStartedAt - now) * scale
      const width = config.windowMs * scale
      const remaining =
        offset > 0
          ? config.limit
          : (this.fixedWindowRemaining.get(windowIndex) ?? config.limit)

      this.context.fillStyle = offset === 0 ? ALLOWED_COLOR : MUTED_COLOR
      this.context.fillText(`${remaining} left`, x + width / 2, size.height / 2 - 42)
    }

    this.context.textAlign = 'left'
    this.context.font = '600 16px system-ui, sans-serif'
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
    const config = this.getConfig()
    const scale = this.windowScale()
    const width = config.windowMs * scale
    const centerX = size.width / 2

    this.drawDottedTrack(now, size)
    this.context.fillStyle = 'rgba(76, 110, 245, 0.24)'
    roundedRectangle(
      this.context,
      centerX - width,
      size.height / 2 - 29,
      width,
      58,
      9,
    )
    this.context.fill()

    const currentEventIds = new Set(this.events.map((event) => event.id))

    for (const eventId of this.evictedEventIds) {
      if (!currentEventIds.has(eventId)) {
        this.evictedEventIds.delete(eventId)
      }
    }

    for (const event of this.events) {
      if (!event.allowed) {
        continue
      }

      const age = now - event.timestamp

      if (age >= config.windowMs && !this.evictedEventIds.has(event.id)) {
        this.evictedEventIds.add(event.id)
        this.evictionPopStarts.set(event.id, now)
      }
    }

    for (const [eventId, startedAt] of this.evictionPopStarts) {
      const progress = Math.min((now - startedAt) / EVICTION_POP_DURATION_MS, 1)

      if (progress >= 1) {
        this.evictionPopStarts.delete(eventId)
        continue
      }

      const event = this.events.find((candidate) => candidate.id === eventId)

      if (event === undefined) {
        continue
      }

      const age = now - event.timestamp
      const x = centerX - age * scale
      const eased = easeOutExpo(progress)
      const radius = 5.5 + eased * 10

      this.context.globalAlpha = 1 - eased
      this.context.strokeStyle = BLOCKED_COLOR
      this.context.lineWidth = 2
      this.context.beginPath()
      this.context.arc(x, size.height / 2, radius, 0, Math.PI * 2)
      this.context.stroke()
      this.context.globalAlpha = 1
    }

    if (this.limiter instanceof SlidingWindowLimiter) {
      const count = this.limiter.count(now)

      this.context.font = '600 13px ui-monospace, monospace'
      this.context.fillStyle = ALLOWED_COLOR
      this.context.textAlign = 'center'
      this.context.fillText(`${count} timestamp${count === 1 ? '' : 's'} stored`, centerX, size.height / 2 - 46)
      this.context.textAlign = 'left'
      this.context.font = '600 16px system-ui, sans-serif'
    }
  }

  private drawFloatingWindow(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const scale = this.windowScale()
    const currentWindowIndex = Math.floor(now / config.windowMs)
    const currentWindowStartedAt = currentWindowIndex * config.windowMs
    const previousWindowStartedAt = currentWindowStartedAt - config.windowMs
    const boxTop = size.height / 2 - 29
    const boxHeight = 58

    this.drawFixedWindows(now, size)

    const width = config.windowMs * scale
    const left = size.width / 2 - width
    const xCurrent = size.width / 2 + (currentWindowStartedAt - now) * scale
    const xPrevious = size.width / 2 + (previousWindowStartedAt - now) * scale

    const floatingSnapshot =
      this.limiter instanceof FloatingWindowLimiter ? this.limiter.snapshot(now) : null
    const overlapZoneLeft = Math.max(left, xPrevious)
    const overlapZoneRight = Math.min(left + width, xPrevious + width)
    const overlapZoneHasTraffic = (floatingSnapshot?.previousWindowCount ?? 0) > 0

    if (overlapZoneRight > overlapZoneLeft) {
      if (overlapZoneHasTraffic) {
        this.context.fillStyle = 'rgba(255, 212, 59, 0.28)'
        roundedRectangle(this.context, overlapZoneLeft, boxTop, overlapZoneRight - overlapZoneLeft, boxHeight, 9)
        this.context.fill()
      }

      this.context.strokeStyle = 'rgba(255, 212, 59, 0.6)'
      this.context.lineWidth = 1.5
      this.context.setLineDash([3, 3])
      roundedRectangle(this.context, overlapZoneLeft, boxTop, overlapZoneRight - overlapZoneLeft, boxHeight, 9)
      this.context.stroke()
      this.context.setLineDash([])
    }

    this.context.strokeStyle = '#ff922b'
    this.context.lineWidth = 2
    roundedRectangle(this.context, xPrevious, boxTop, width, boxHeight, 9)
    this.context.stroke()

    this.context.strokeStyle = ALLOWED_COLOR
    this.context.lineWidth = 2
    roundedRectangle(this.context, xCurrent, boxTop, width, boxHeight, 9)
    this.context.stroke()

    this.context.strokeStyle = 'rgba(206, 212, 218, 0.48)'
    this.context.lineWidth = 2
    this.context.setLineDash([5, 4])
    roundedRectangle(this.context, left, boxTop, width, boxHeight, 9)
    this.context.stroke()
    this.context.setLineDash([])

    if (floatingSnapshot !== null) {
      this.context.font = '600 11px ui-monospace, monospace'
      this.context.fillStyle = '#ff922b'
      this.context.fillText('previous', xPrevious + 8, boxTop - 10)
      this.context.fillStyle = ALLOWED_COLOR
      this.context.fillText('current', xCurrent + 8, boxTop - 10)

      if (overlapZoneRight > overlapZoneLeft) {
        this.context.fillStyle = 'rgba(255, 212, 59, 0.85)'
        this.context.fillText('overlap', overlapZoneLeft + 4, boxTop + boxHeight + 16)
      }

      this.context.font = '600 16px system-ui, sans-serif'
      const label = `~${floatingSnapshot.estimate.toFixed(1)} requests`
      this.context.fillStyle = MUTED_COLOR
      this.context.fillText(label, left + 12, boxTop - 40)
    }
  }

  private drawTokenBucket(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const tokens =
      this.limiter instanceof TokenBucketLimiter
        ? Math.floor(this.limiter.tokenCount(now))
        : 0
    const ballRadius = 12
    const ballSpacing = ballRadius * 2 + 6
    const bucketHeight = Math.min(config.limit * ballSpacing + 20, size.height - 140)
    const centerX = size.width - 130
    const bucketTopY = size.height / 2 - bucketHeight / 2 + 24
    const bucketBottomY = bucketTopY + bucketHeight

    this.drawDottedTrack(now, size)

    if (this.lastTokenCount === -1) {
      this.lastTokenCount = tokens
    } else if (tokens > this.lastTokenCount) {
      for (let index = this.lastTokenCount; index < tokens; index += 1) {
        this.tokenFallStarts.set(index, now)
      }
      this.lastTokenCount = tokens
    } else if (tokens < this.lastTokenCount) {
      for (let index = tokens; index < this.lastTokenCount; index += 1) {
        this.tokenFallStarts.delete(index)
        this.tokenLeaveStarts.set(index, now)
      }
      this.lastTokenCount = tokens
    }

    drawPail(this.context, {
      centerX,
      topY: bucketTopY,
      bottomY: bucketBottomY,
      topHalfWidth: 92,
      bottomHalfWidth: 68,
    })

    if (this.limiter instanceof TokenBucketLimiter) {
      const snapshot = this.limiter.snapshot(now)
      const clockRadius = 26
      const clockX = centerX
      const clockY = bucketTopY - 68
      const clockProgress = snapshot.msSinceRefill / snapshot.refillIntervalMs

      drawClock(this.context, clockX, clockY, clockRadius, clockProgress, ALLOWED_COLOR)

      this.context.font = '600 20px ui-monospace, monospace'
      this.context.fillStyle = MUTED_COLOR
      this.context.textAlign = 'center'
      const seconds = (snapshot.refillIntervalMs / 1_000).toString().replace(/\.0$/, '')
      this.context.fillText(`+${snapshot.refillRate} / ${seconds}s`, clockX, clockY - clockRadius - 16)
      this.context.textAlign = 'left'
      this.context.font = '600 16px system-ui, sans-serif'
    }

    for (let tokenIndex = 0; tokenIndex < tokens; tokenIndex += 1) {
      const landingY = bucketBottomY - 16 - tokenIndex * ballSpacing
      const fallStartedAt = this.tokenFallStarts.get(tokenIndex)
      let ballY = landingY

      if (fallStartedAt !== undefined) {
        const progress = Math.min((now - fallStartedAt) / BALL_FALL_DURATION_MS, 1)
        const eased = easeOutSoftBack(progress)
        const fromY = bucketTopY - 90
        ballY = fromY + (landingY - fromY) * eased

        if (progress >= 1) {
          this.tokenFallStarts.delete(tokenIndex)
        }
      }

      drawBall(this.context, centerX, ballY, ballRadius, ALLOWED_COLOR)
    }

    for (let slotIndex = tokens; slotIndex < config.limit; slotIndex += 1) {
      const slotY = bucketBottomY - 16 - slotIndex * ballSpacing

      if (slotY < bucketTopY + ballRadius) {
        break
      }

      drawEmptySlot(this.context, centerX, slotY, ballRadius)
    }

    this.context.font = '600 20px ui-monospace, monospace'
    this.context.fillStyle = MUTED_COLOR
    this.context.textAlign = 'center'
    this.context.fillText(`${tokens} / ${config.limit} tokens`, centerX, bucketBottomY + 36)
    this.context.textAlign = 'left'
    this.context.font = '600 16px system-ui, sans-serif'

    for (const [tokenIndex, leaveStartedAt] of this.tokenLeaveStarts) {
      const progress = Math.min((now - leaveStartedAt) / BALL_LEAVE_DURATION_MS, 1)

      if (progress >= 1) {
        this.tokenLeaveStarts.delete(tokenIndex)
        continue
      }

      const landingY = bucketBottomY - 16 - tokenIndex * ballSpacing
      const eased = easeOutExpo(progress)
      const x = centerX - eased * (centerX - size.width / 2) * 0.4
      const y = landingY - eased * 55
      const radius = ballRadius * (1 - eased * 0.35)

      this.context.globalAlpha = 1 - eased
      drawBall(this.context, x, y, radius, ALLOWED_COLOR)
      this.context.globalAlpha = 1
    }
  }

  private drawLeakyBucket(now: number, size: CanvasSize): void {
    const config = this.getConfig()
    const snapshot =
      this.limiter instanceof LeakyBucketLimiter
        ? this.limiter.snapshot(now)
        : { capacity: config.limit, queueDepth: 0, drainIntervalMs: config.refillIntervalMs, drainRate: config.refillRate, msSinceDrain: 0 }
    const queuedItems = Math.round(snapshot.queueDepth)
    const ballRadius = 12
    const ballSpacing = ballRadius * 2 + 6
    const bucketHeight = Math.min(config.limit * ballSpacing + 24, size.height - 190)
    const centerX = size.width - 130
    const bucketTopY = size.height / 2 - bucketHeight / 2 - 44
    const bucketBottomY = bucketTopY + bucketHeight

    this.drawDottedTrack(now, size)

    if (this.lastQueueDepth === -1) {
      this.lastQueueDepth = queuedItems
    } else if (queuedItems > this.lastQueueDepth) {
      for (let index = this.lastQueueDepth; index < queuedItems; index += 1) {
        this.queueFallStarts.set(index, now)
      }
      this.lastQueueDepth = queuedItems
    } else if (queuedItems < this.lastQueueDepth) {
      for (const index of this.queueFallStarts.keys()) {
        if (index >= queuedItems) {
          this.queueFallStarts.delete(index)
        }
      }
      this.lastQueueDepth = queuedItems
    }

    const lastRejectionAt = this.events.reduce(
      (latest, event) => (!event.allowed && event.timestamp > latest ? event.timestamp : latest),
      -Infinity,
    )
    const buzzProgress = Math.min((now - lastRejectionAt) / REJECT_BUZZ_DURATION_MS, 1)
    const isBuzzing = buzzProgress < 1
    const shakeOffset = isBuzzing
      ? Math.sin(buzzProgress * Math.PI * 7) * 9 * (1 - buzzProgress)
      : 0
    const bucketCenterX = centerX + shakeOffset

    drawPail(this.context, {
      centerX: bucketCenterX,
      topY: bucketTopY,
      bottomY: bucketBottomY,
      topHalfWidth: 92,
      bottomHalfWidth: 68,
    })

    if (isBuzzing) {
      const buzzAlpha = 1 - buzzProgress
      this.context.strokeStyle = `rgba(255, 82, 82, ${buzzAlpha})`
      this.context.lineWidth = 5
      roundedRectangle(this.context, bucketCenterX - 100, bucketTopY - 16, 200, bucketHeight + 32, 20)
      this.context.stroke()
    }

    const drainProgress = Math.min(snapshot.msSinceDrain / snapshot.drainIntervalMs, 1)

    this.context.font = '600 20px ui-monospace, monospace'
    this.context.fillStyle = MUTED_COLOR
    this.context.textAlign = 'center'
    this.context.fillText(`queued ${queuedItems} / ${snapshot.capacity}`, bucketCenterX, bucketTopY - 26)

    for (let itemIndex = 0; itemIndex < queuedItems; itemIndex += 1) {
      const landingY = bucketBottomY - 16 - itemIndex * ballSpacing
      const fallStartedAt = this.queueFallStarts.get(itemIndex)
      let ballY = landingY

      if (fallStartedAt !== undefined) {
        const progress = Math.min((now - fallStartedAt) / BALL_FALL_DURATION_MS, 1)
        const eased = easeOutSoftBack(progress)
        const fromY = bucketTopY - 90
        ballY = fromY + (landingY - fromY) * eased

        if (progress >= 1) {
          this.queueFallStarts.delete(itemIndex)
        }
      }

      drawBall(this.context, bucketCenterX, ballY, ballRadius, TRACK_COLOR)
    }

    for (let slotIndex = queuedItems; slotIndex < config.limit; slotIndex += 1) {
      const slotY = bucketBottomY - 16 - slotIndex * ballSpacing

      if (slotY < bucketTopY + ballRadius) {
        break
      }

      drawEmptySlot(this.context, bucketCenterX, slotY, ballRadius)
    }

    const spoutY = bucketBottomY

    if (snapshot.queueDepth > 0) {
      const dripY = spoutY + drainProgress * 44
      const dripAlpha = 1 - drainProgress * 0.55

      this.context.globalAlpha = dripAlpha
      drawBall(this.context, bucketCenterX, dripY, 8, ALLOWED_COLOR)
      this.context.globalAlpha = 1
    }

    const clockRadius = 26
    const clockY = spoutY + 76
    drawClock(this.context, bucketCenterX, clockY, clockRadius, drainProgress, TRACK_COLOR)

    this.context.fillStyle = MUTED_COLOR
    const drainSeconds = (snapshot.drainIntervalMs / 1_000).toString().replace(/\.0$/, '')
    this.context.fillText(`drain ${snapshot.drainRate} / ${drainSeconds}s`, bucketCenterX, clockY + clockRadius + 28)

    this.context.textAlign = 'left'
    this.context.font = '600 16px system-ui, sans-serif'
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

  private drawNowLine(size: CanvasSize): void {
    const x = size.width / 2

    this.context.save()
    this.context.strokeStyle = 'rgba(233, 241, 244, 0.4)'
    this.context.lineWidth = 1.5
    this.context.setLineDash([5, 5])
    this.context.beginPath()
    this.context.moveTo(x, 0)
    this.context.lineTo(x, size.height)
    this.context.stroke()
    this.context.restore()
  }

  private drawNowAndRemaining(now: number, size: CanvasSize): void {
    this.context.fillStyle = MUTED_COLOR
    this.context.fillText('now', size.width / 2 + 7, size.height - 14)

    const algorithmsWithOwnRemainingDisplay: RateLimitAlgorithm[] = [
      'fixed-window',
      'floating-window',
      'token-bucket',
      'leaky-bucket',
    ]

    if (algorithmsWithOwnRemainingDisplay.includes(this.getConfig().algorithm)) {
      return
    }

    const remaining = this.limiter.remaining(now)
    const formattedRemaining = Number.isInteger(remaining)
      ? remaining.toFixed(0)
      : remaining.toFixed(1)

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
    const floatingWindow: FloatingWindowSnapshot | undefined =
      this.limiter instanceof FloatingWindowLimiter
        ? this.limiter.snapshot(now)
        : undefined

    this.lastSnapshotAt = now
    this.onSnapshot({
      allowed,
      blocked,
      remaining: this.limiter.remaining(now),
      limit: this.getConfig().limit,
      resetMs: this.limiter.resetMs(now),
      retryAfterMs: this.limiter.retryAfterMs(now),
      lastAllowed: this.lastResult?.allowed ?? null,
      playing: this.playing,
      started: this.started,
      stopped: this.stopped,
      floatingWindow,
    })
  }

  private handleResize(): void {
    this.draw(this.virtualNow)
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    this.visible = entries[0]?.isIntersecting ?? true
  }
}
