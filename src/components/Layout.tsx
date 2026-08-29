import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button } from './ui'

export default function Layout({ title, back, children }: {
  title: string; back?: string; children: ReactNode
}) {
  const { teacher, signOut } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {back && (
            <Link to={back} className="text-sm text-slate-500 hover:text-slate-900">← 返回</Link>
          )}
          <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
          <span className="hidden text-sm text-slate-500 sm:inline">{teacher?.display_name}</span>
          <Button variant="ghost" onClick={signOut}>登出</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
