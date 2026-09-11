import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import HealthTabs, { type HealthTab } from './Tabs'
import type { StudentProfile } from '../lib/types'

/** 三個健康頁共用的頁首：姓名、班級座號、學期，以及分頁列 */
export default function HealthHeader({ student, isPreview, tab }: {
  student: StudentProfile
  isPreview: boolean
  tab: HealthTab
}) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="bg-[#0B4A44] px-5 pb-3 pt-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-bold tracking-wide">{student.name}</div>
          <div className="mt-0.5 text-[13px] opacity-70">
            {student.class_name} 班・座號 {student.seat_no ?? '—'}・
            {student.academic_year} 學年度第 {student.semester} 學期
          </div>
        </div>
        <button
          onClick={() => (isPreview ? navigate('/') : void signOut())}
          className="-m-2 shrink-0 p-2 text-[13px] opacity-70 hover:opacity-100"
        >
          {isPreview ? '離開預覽' : '登出'}
        </button>
      </div>
      <HealthTabs current={tab} preview={isPreview} />
    </header>
  )
}

/** 教師預覽時的提醒條，三個頁面共用 */
export function PreviewBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-3 mt-3 rounded-lg border border-[#E2C9A6] bg-[#FDF3E3] px-4 py-3 text-sm text-[#8A5310]">
      <strong>預覽模式</strong>　{children}
    </div>
  )
}
