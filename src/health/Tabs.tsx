import { Link } from 'react-router-dom'

export type HealthTab = 'register' | 'selfcheck' | 'analysis' | 'goal' | 'checkin' | 'plate'

const TABS: { key: HealthTab; label: string; path: string }[] = [
  { key: 'register', label: '登記', path: '/health' },
  { key: 'selfcheck', label: '自我檢測', path: '/health/selfcheck' },
  { key: 'plate', label: '我的餐盤', path: '/health/plate' },
  { key: 'analysis', label: '分析', path: '/health/analysis' },
  { key: 'goal', label: '目標', path: '/health/goal' },
  { key: 'checkin', label: '打卡', path: '/health/checkin' },
]

/**
 * 三個頁面之間的分頁切換。
 * 學生掃一次 QR code 進來就能在三者間移動，不用重掃，也刻意不做成漢堡選單。
 */
export default function HealthTabs({ current, preview = false }: {
  current: HealthTab
  preview?: boolean
}) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto pt-3">
      {TABS.map((t) => {
        const on = t.key === current
        return (
          <Link
            key={t.key}
            to={preview ? `${t.path === '/health' ? '/health' : t.path}/preview` : t.path}
            aria-current={on ? 'page' : undefined}
            className={`min-w-[72px] flex-1 rounded-lg py-2 text-center text-[12.5px] transition ${
              on
                ? 'bg-white/95 font-bold text-[#0B4A44]'
                : 'bg-white/10 text-white/75 hover:bg-white/20'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
