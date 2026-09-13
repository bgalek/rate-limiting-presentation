import { type MouseEventHandler, type ReactNode } from 'react'
import { IconSend2 } from '@tabler/icons-react'
import { HIT_BUTTON_CLASS } from './classNames'

export interface SendRequestButtonProps {
  children?: ReactNode
  className?: string
  onClick: MouseEventHandler<HTMLButtonElement>
}

export default function SendRequestButton({
  children = 'Send request',
  className = '',
  onClick,
}: SendRequestButtonProps) {
  return (
    <button
      type="button"
      className={`${HIT_BUTTON_CLASS} ${className}`}
      onClick={onClick}
    >
      <span>
        <IconSend2 aria-hidden="true" size={20} stroke={2} />
      </span>
      {children}
    </button>
  )
}
