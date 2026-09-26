import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>
}

export function RoleLine({ children, role }: { children: ReactNode; role: 'bad' | 'good' }) {
  return (
    <div className={`role-line role-line--${role}`}>
      <span>{role === 'good' ? 'Good cop' : 'Bad cop'}</span>
      <p>{children}</p>
    </div>
  )
}

export function DialogueLine({ children, role }: { children: string; role: 'bad' | 'good' }) {
  return (
    <div className={`dialogue-line dialogue-line--${role}`}>
      <span className="dialogue-line__speaker">{role === 'good' ? 'Good cop' : 'Bad cop'}</span>
      <p>{children}</p>
    </div>
  )
}

export function Metric({ label, tone = 'cyan', value }: { label: string; tone?: 'cyan' | 'yellow'; value: string }) {
  return <div className={`metric metric--${tone}`}><span>{label}</span><strong>{value}</strong></div>
}

export function Notes({ children }: { children: ReactNode }) {
  return <aside className="notes">{children}</aside>
}
