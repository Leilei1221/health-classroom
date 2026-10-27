import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button } from './ui'

/**
 * 教師後台的外框（可愛貼紙風）。
 *
 * 手機：頂端標題列加底部導覽列，目前所在的項目凸起成黃色圓圈。
 * iPad 以上（md）：標題列照舊，導覽改成左側直排。
 * 導覽只放最常用的四個地方；其餘功能（學生端內容、外部網站）在首頁的卡片裡。
 */

const NAV: { key: string; label: string; to: string; icon: string; match: (path: string) => boolean }[] = [
  {
    key: 'home', label: '首頁', to: '/', match: (p) => p === '/',
    icon: 'M3 11 l9-8 9 8 v10 H3z M10 21 v-6 h4 v6',
  },
  {
    key: 'classes', label: '班級', to: '/classes', match: (p) => p.startsWith('/class'),
    icon: 'M9 4h6v3H9z M7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1 M9 13l2 2 4-4',
  },
  {
    key: 'health', label: '健康', to: '/health/progress', match: (p) => p.startsWith('/health'),
    icon: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  },
  {
    key: 'demo', label: '示範', to: '/demo', match: (p) => p === '/demo',
    icon: 'M3 5h18v11H3z M8 21h8 M12 16v5',
  },
]

function NavIcon({ d, size = 30 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function SideRail({ path }: { path: string }) {
  return (
    <nav
      aria-label="主要功能"
      className="fixed inset-y-0 left-0 z-20 hidden w-[112px] flex-col items-center gap-2.5 border-r-[2.5px] border-cute-ink bg-white py-5 md:flex"
    >
      <div className="absolute inset-y-0 right-[5px] border-r-[1.5px] border-dashed border-cute-ink/35" aria-hidden />
      <div className="cute-block mb-3 h-14 w-14 rounded-[18px] bg-cute-yellow" aria-hidden>
        <svg width="34" height="34" viewBox="0 0 56 56" fill="none" stroke="#3A3535" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 48 C9 35 7 21 14 15 C20 10 26 13 28 18 C30 13 36 10 42 15 C49 21 47 35 28 48Z" fill="#F4B5AE" />
        </svg>
      </div>
      {NAV.map((n) => {
        const on = n.match(path)
        return (
          <Link
            key={n.key}
            to={n.to}
            aria-current={on ? 'page' : undefined}
            className={`flex h-[78px] w-20 flex-col items-center justify-center gap-1 rounded-[22px] text-[13px] font-bold transition ${
              on
                ? 'border-[2.5px] border-cute-ink bg-cute-yellow text-cute-ink shadow-[2px_3px_0_#3A3535]'
                : 'text-cute-mute hover:bg-cute-butter'
            }`}
          >
            <NavIcon d={n.icon} />
            {n.label}
          </Link>
        )
      })}
    </nav>
  )
}

function BottomBar({ path }: { path: string }) {
  return (
    <nav
      aria-label="主要功能"
      className="fixed inset-x-0 bottom-0 z-20 grid h-[84px] grid-cols-4 border-t-[2.5px] border-cute-ink bg-white px-2 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-[5px] border-t-[1.5px] border-dashed border-cute-ink/35" aria-hidden />
      {NAV.map((n) => {
        const on = n.match(path)
        return (
          <Link
            key={n.key}
            to={n.to}
            aria-current={on ? 'page' : undefined}
            className={`relative flex h-full flex-col items-center justify-end gap-0.5 text-xs font-bold ${on ? 'text-cute-ink' : 'text-cute-mute'}`}
          >
            {on ? (
              <span className="absolute -top-[34px] flex h-[62px] w-[62px] items-center justify-center rounded-full border-[2.5px] border-cute-ink bg-cute-yellow shadow-[2px_3px_0_#3A3535]">
                <NavIcon d={n.icon} />
              </span>
            ) : (
              <NavIcon d={n.icon} />
            )}
            {n.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function Layout({ title, back, subtitle, actions, maxWidth = 'max-w-6xl', children }: {
  title: string
  back?: string
  /** 標題下方的小字（例如班級學期、人數） */
  subtitle?: string
  /** 標題列右側的額外連結或按鈕 */
  actions?: ReactNode
  /** 內容區最大寬度，預設 max-w-6xl */
  maxWidth?: string
  children: ReactNode
}) {
  const { teacher, signOut } = useAuth()
  const { pathname } = useLocation()
  return (
    <div className="cute-page min-h-screen">
      <SideRail path={pathname} />
      <div className="md:pl-[112px]">
        <header className="sticky top-0 z-10 px-3 pt-3">
          <div className={`cute-card mx-auto flex items-center gap-2.5 rounded-[28px] py-2 pl-2.5 pr-3 ${maxWidth}`}>
            {back ? (
              <Link to={back} aria-label="返回" className="cute-chip w-11 shrink-0 bg-white !px-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </Link>
            ) : (
              <div className="cute-block h-11 w-11 rounded-[14px] bg-cute-yellow" aria-hidden>
                <svg width="28" height="28" viewBox="0 0 56 56" fill="none" stroke="#3A3535" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M28 48 C9 35 7 21 14 15 C20 10 26 13 28 18 C30 13 36 10 42 15 C49 21 47 35 28 48Z" fill="#F4B5AE" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold leading-tight">{title}</h1>
              {subtitle && <p className="truncate text-xs text-cute-mute">{subtitle}</p>}
            </div>
            {actions}
            <span className="hidden text-sm text-cute-mute sm:inline">{teacher?.display_name}</span>
            <Button variant="secondary" onClick={signOut} className="!min-h-[40px] !px-3.5 text-[13px]">登出</Button>
          </div>
        </header>
        <main className={`mx-auto px-4 py-5 pb-28 md:pb-8 ${maxWidth}`}>{children}</main>
      </div>
      <BottomBar path={pathname} />
    </div>
  )
}
