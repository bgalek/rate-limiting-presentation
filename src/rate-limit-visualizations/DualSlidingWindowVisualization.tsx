import { useRef, useState } from 'react'
import {
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react'
import type {
  VisualizationController,
  VisualizationSnapshot,
} from './canvas-engine'
import FloatingWindowVisualization from './FloatingWindowVisualization'
import SlidingWindowVisualization from './SlidingWindowVisualization'
import {
  SECONDARY_BUTTON_CLASS,
} from './classNames'
import SendRequestButton from './SendRequestButton'

export interface DualSlidingWindowVisualizationProps {
  limit?: number
}

const INITIAL_SNAPSHOT: VisualizationSnapshot = {
  allowed: 0,
  blocked: 0,
  remaining: 6,
  playing: false,
  started: true,
}

export default function DualSlidingWindowVisualization({
  limit = 6,
}: DualSlidingWindowVisualizationProps) {
  const preciseController = useRef<VisualizationController | null>(null)
  const floatingController = useRef<VisualizationController | null>(null)
  const [playing, setPlaying] = useState(true)
  const [preciseSnapshot, setPreciseSnapshot] =
    useState<VisualizationSnapshot>(INITIAL_SNAPSHOT)
  const [floatingSnapshot, setFloatingSnapshot] =
    useState<VisualizationSnapshot>(INITIAL_SNAPSHOT)

  function handlePreciseController(
    controller: VisualizationController | null,
  ): void {
    preciseController.current = controller
  }

  function handleFloatingController(
    controller: VisualizationController | null,
  ): void {
    floatingController.current = controller
  }

  function hit(): void {
    preciseController.current?.hit()
    floatingController.current?.hit()
    setPlaying(false)
  }

  function togglePlaying(): void {
    const nextPlaying = !playing
    setPlaying(nextPlaying)
    preciseController.current?.setPlaying(nextPlaying)
    floatingController.current?.setPlaying(nextPlaying)
  }

  return (
    <div className="relative">
      <div className="relative grid overflow-hidden rounded-xl bg-rate-panel [&>div+div]:border-t [&>div+div]:border-rate-border/50 [&_canvas]:rounded-none">
        <SlidingWindowVisualization
          limit={limit}
          autoPlay
          hideControls
          height={156}
          onControllerReady={handlePreciseController}
          onSnapshot={setPreciseSnapshot}
        />
        <FloatingWindowVisualization
          limit={limit}
          autoPlay
          hideControls
          height={156}
          onControllerReady={handleFloatingController}
          onSnapshot={setFloatingSnapshot}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SendRequestButton onClick={hit} />
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={togglePlaying}
        >
          {playing ? (
            <IconPlayerPause aria-hidden="true" size={20} stroke={2} />
          ) : (
            <IconPlayerPlay aria-hidden="true" size={20} stroke={2} />
          )}
          {playing ? 'Pause' : 'Resume'} stream
        </button>
      </div>

      <div
        className="flex flex-wrap justify-center gap-x-8 gap-y-2 pt-4 text-base text-rate-muted [&_strong]:text-rate-text"
        aria-live="polite"
      >
        <span>
          Precise window: limited{' '}
          <strong>{preciseSnapshot.blocked}</strong>
        </span>
        <span>
          Approximated: limited <strong>{floatingSnapshot.blocked}</strong>
        </span>
      </div>
    </div>
  )
}
