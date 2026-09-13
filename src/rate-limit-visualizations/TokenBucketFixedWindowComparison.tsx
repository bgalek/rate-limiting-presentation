import { useRef, useState } from 'react'
import {
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react'
import type { VisualizationController } from './canvas-engine'
import TokenBucketVisualization from './TokenBucketVisualization'
import UserFixedWindowVisualization from './UserFixedWindowVisualization'
import {
  SECONDARY_BUTTON_CLASS,
} from './classNames'
import SendRequestButton from './SendRequestButton'

export interface TokenBucketFixedWindowComparisonProps {
  limit?: number
  windowMs?: number
}

export default function TokenBucketFixedWindowComparison({
  limit = 6,
  windowMs = 8_000,
}: TokenBucketFixedWindowComparisonProps) {
  const tokenController = useRef<VisualizationController | null>(null)
  const windowController = useRef<VisualizationController | null>(null)
  const [playing, setPlaying] = useState(true)

  function handleTokenController(
    controller: VisualizationController | null,
  ): void {
    tokenController.current = controller
  }

  function handleWindowController(
    controller: VisualizationController | null,
  ): void {
    windowController.current = controller
  }

  function hit(): void {
    tokenController.current?.hit()
    windowController.current?.hit()
    setPlaying(false)
  }

  function togglePlaying(): void {
    const nextPlaying = !playing
    setPlaying(nextPlaying)
    tokenController.current?.setPlaying(nextPlaying)
    windowController.current?.setPlaying(nextPlaying)
  }

  return (
    <div className="relative">
      <div className="relative grid overflow-hidden rounded-xl bg-rate-panel [&>div+div]:border-t [&>div+div]:border-rate-border/50 [&_canvas]:rounded-none">
        <TokenBucketVisualization
          limit={limit}
          windowMs={windowMs}
          refillIntervalMs={windowMs}
          refillRate={limit}
          autoPlay
          hideControls
          height={156}
          onControllerReady={handleTokenController}
        />
        <UserFixedWindowVisualization
          limit={limit}
          windowMs={windowMs}
          autoPlay
          hideControls
          height={156}
          showBoundaryLabels={false}
          onControllerReady={handleWindowController}
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
    </div>
  )
}
