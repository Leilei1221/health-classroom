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
    primary:
      'bg-gradient-to-br from-[#6F8FAF] to-mist-main text-white shadow-[0_6px_14px_rgb(79_111_146/0.32),inset_0_1px_0_rgb(255_255_255/0.45)] hover:brightness-105',
    secondary: 'border border-mist-main/30 bg-white/70 text-mist-deep hover:bg-white',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-mist-mute hover:bg-white/60',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[40px] rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-mist-deep">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-mist-main/40 bg-white/85 px-3 py-2 text-sm outline-none focus:border-mist-main focus:ring-2 focus:ring-mist-light/50'
