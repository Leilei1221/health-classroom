import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import GlassPage from './GlassPage'
import { Button } from './ui'

export default function Layout({ title, back, children }: {
  title: string; back?: string; children: ReactNode
}) {
  const { teacher, signOut } = useAuth()
  return (
    <GlassPage>
      <header className="sticky top-0 z-10 px-3 pt-3">
        <div className="glass mx-auto flex max-w-6xl items-center gap-2 rounded-[28px] py-2 pl-2.5 pr-3">
          {back && (
            <Link
              to={back}
              aria-label="返回"
              className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mist-deep"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
          )}
          <h1 className={`min-w-0 flex-1 truncate text-base font-bold ${back ? '' : 'pl-2'}`}>{title}</h1>
          <span className="hidden text-sm text-mist-mute sm:inline">{teacher?.display_name}</span>
          <Button variant="ghost" onClick={signOut}>登出</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </GlassPage>
  )
}
