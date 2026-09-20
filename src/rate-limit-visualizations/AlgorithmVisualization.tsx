import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
} from '@tabler/icons-react'
import {
  CanvasVisualizationEngine,
  type VisualizationConfig,
  type VisualizationController,
  type VisualizationSnapshot,
} from './canvas-engine'
import type { RateLimitAlgorithm } from './algorithms'
import {
  CONTROLS_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  START_OVERLAY_CLASS,
} from './classNames'
import SendRequestButton from './SendRequestButton'

export interface AlgorithmVisualizationProps {
  algorithm: RateLimitAlgorithm
  limit?: number
  windowMs?: number
  refillIntervalMs?: number
  refillRate?: number
  burstMode?: boolean
  steadyMode?: boolean
  autoPlay?: boolean
  startPaused?: boolean
  showBoundaryLabels?: boolean
  hideControls?: boolean
  height?: number
  className?: string
  onControllerReady?: (controller: VisualizationController | null) => void
  onSnapshot?: (snapshot: VisualizationSnapshot) => void
}

const EMPTY_SNAPSHOT: VisualizationSnapshot = {
  allowed: 0,
  blocked: 0,
  remaining: 0,
  limit: 0,
  resetMs: 0,
  retryAfterMs: 0,
  lastAllowed: null,
  playing: true,
  started: true,
  stopped: false,
}

export default function AlgorithmVisualization({
  algorithm,
  limit = 6,
  windowMs = 8_000,
  refillIntervalMs = 1_800,
  refillRate = 1,
  burstMode = false,
  steadyMode = false,
  autoPlay = true,
  startPaused = false,
  showBoundaryLabels = true,
  hideControls = false,
  height = 176,
  className = '',
  onControllerReady,
  onSnapshot,
}: AlgorithmVisualizationProps) {
  const [snapshot, setSnapshot] = useState<VisualizationSnapshot>({
    ...EMPTY_SNAPSHOT,
    remaining: limit,
    limit,
    started: !startPaused,
  })
  const controllerRef = useRef<VisualizationController | null>(null)
  const configRef = useRef<VisualizationConfig>({
    algorithm,
    limit,
    windowMs,
    refillIntervalMs,
    refillRate,
    burstMode,
    steadyMode,
    autoPlay,
    startPaused,
    showBoundaryLabels,
  })
  const onControllerReadyRef = useRef(onControllerReady)
  const onSnapshotRef = useRef(onSnapshot)

  useEffect(
    function synchronizeEngineConfiguration() {
      configRef.current = {
        algorithm,
        limit,
        windowMs,
        refillIntervalMs,
        refillRate,
        burstMode,
        steadyMode,
        autoPlay,
        startPaused,
        showBoundaryLabels,
      }
      onControllerReadyRef.current = onControllerReady
      onSnapshotRef.current = onSnapshot
    },
    [
      algorithm,
      autoPlay,
      limit,
      onControllerReady,
      onSnapshot,
      refillIntervalMs,
      refillRate,
      burstMode,
      steadyMode,
      showBoundaryLabels,
      startPaused,
      windowMs,
    ],
  )

  const canvasRef = useCallback(function connectCanvas(
    canvas: HTMLCanvasElement | null,
  ) {
    controllerRef.current?.destroy()
    controllerRef.current = null

    if (canvas === null) {
      onControllerReadyRef.current?.(null)
      return
    }

    function getConfig(): VisualizationConfig {
      return configRef.current
    }

    function handleSnapshot(nextSnapshot: VisualizationSnapshot): void {
      setSnapshot(nextSnapshot)
      onSnapshotRef.current?.(nextSnapshot)
    }

    const controller = new CanvasVisualizationEngine(
      canvas,
      getConfig,
      handleSnapshot,
    )
    controllerRef.current = controller
    onControllerReadyRef.current?.(controller)
  }, [])

  function hit(): void {
    controllerRef.current?.hit()
  }

  function togglePlaying(): void {
    controllerRef.current?.setPlaying(!snapshot.playing)
  }

  function toggleStopped(): void {
    controllerRef.current?.setStopped(!snapshot.stopped)
  }

  function start(): void {
    controllerRef.current?.start()
  }

  const rootClassName = ['relative min-w-0 w-full', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassName}>
      <canvas
        ref={canvasRef}
        className="block w-full rounded-xl border border-rate-border/50 bg-rate-canvas shadow-xl shadow-black/15"
        style={{ height }}
        role="img"
        aria-label={`${algorithm} rate-limit request timeline`}
      />

      {!snapshot.started && (
        <div className={START_OVERLAY_CLASS}>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={start}>
            <IconPlayerPlay aria-hidden="true" size={21} stroke={2} />
            Start animation
          </button>
        </div>
      )}

      {!hideControls && snapshot.started && (
        <div className={CONTROLS_CLASS}>
          <SendRequestButton onClick={hit} />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={togglePlaying}
          >
            {snapshot.playing ? (
              <IconPlayerPause aria-hidden="true" size={20} stroke={2} />
            ) : (
              <IconPlayerPlay aria-hidden="true" size={20} stroke={2} />
            )}
            {snapshot.playing ? 'Pause' : 'Resume'} stream
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={toggleStopped}
          >
            {snapshot.stopped ? (
              <IconPlayerPlay aria-hidden="true" size={20} stroke={2} />
            ) : (
              <IconPlayerStop aria-hidden="true" size={20} stroke={2} />
            )}
            {snapshot.stopped ? 'Resume' : 'Stop'}
          </button>
        </div>
      )}
    </div>
  )
}
