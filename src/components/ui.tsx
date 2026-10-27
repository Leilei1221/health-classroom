import type { ReactNode } from 'react'

export function Spinner({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-mist-mute">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-mist-main/30 border-t-mist-main" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {message}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-sm text-mist-mute">{children}</div>
}

export function Button({
  children, onClick, variant = 'primary', disabled, type = 'button', className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const styles = {
    primary: 'cute-btn',
    secondary: 'cute-chip bg-white',
    danger: 'cute-chip bg-cute-pink',
    ghost: 'inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-sm font-bold text-cute-mute transition hover:bg-cute-butter',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-cute-ink">{label}</span>
      {children}
    </label>
  )
}

export const inputClass = 'cute-field'
