import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { myLinks } from '../lib/api'
import type { StudentLink, StudentProfile } from '../lib/types'
import GlassPage from '../components/GlassPage'

/**
 * 學生入口頁。
 *
 * 掃 QR code 進來的第一頁。以前這裡直接就是身體數值登記表單，
 * 六個作業要靠上面那排分頁去找；外面的活動（CPR 節奏、情境解謎）
 * 則是老師另外發網址。這一頁把兩邊放在一起。
 *
 * 兩種班級看到的東西不一樣：
 * - 有開健康管理的班（305–309）：我的作業六張卡＋課程活動
 * - 沒開的班（基礎急救概論那種多元選修）：只有課程活動，
 *   上面寫一行「這門課沒有健康管理作業」——不是錯誤訊息，是實話
 *
 * 這一頁不寫資料庫，只呼叫 hc_my_links() 讀連結。
 * 那支 RPC 回來的清單已經過濾好也排好了，這裡直接照著印。
 */

const TASKS: { to: string; label: string; desc: string; icon: string }[] = [
  { to: '/health/register', label: '身體數值登記', desc: '身高、體重、血壓等，量完當場填', icon: 'M3 12h4l2.5-6 4 12 2.5-6H21' },
  { to: '/health/selfcheck', label: '課本自我檢測', desc: '課本上的量表，填完看自己的結果', icon: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M9 14l2 2 4-4' },
  { to: '/health/plate', label: '我的餐盤', desc: '記錄六大類食物吃了幾份', icon: 'M4 11h16a8 8 0 0 1-16 0zM9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5' },
  { to: '/health/analysis', label: '健康分析', desc: '把你填的數值換成看得懂的話', icon: 'M5 20V11M12 20V4M19 20v-6' },
  { to: '/health/goal', label: 'SMART 目標', desc: '訂一個這學期做得到的目標', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' },
  { to: '/health/checkin', label: '第一週打卡', desc: '目標訂好之後的七天紀錄', icon: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4' },
]

/** 課程活動的連結來自資料庫，沒有各自的圖示，統一用「另開分頁」的圖 */
const LINK_ICON = 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'

function Icon({ d, size = 24, className, stroke = 1.8 }: {
  d: string; size?: number; className?: string; stroke?: number
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}
    >
      <path d={d} />
    </svg>
  )
}

function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1.5">
      <h2 className="text-[15px] font-bold tracking-[0.12em] text-mist-deep">{children}</h2>
      {aside && <span className="text-xs text-mist-mute">{aside}</span>}
    </div>
  )
}

const CARD = 'glass flex min-h-[76px] items-center gap-3.5 rounded-3xl p-3.5 transition active:scale-[0.99]'
const NOTE = 'glass rounded-3xl border-dashed px-4 py-3.5 text-[13px] leading-relaxed text-mist-mute'

/** 預覽用的假連結。示範區不讀資料庫，這一頁也不例外 */
const PREVIEW_LINKS: StudentLink[] = [
  { id: 'p1', title: 'CPR 節奏練習', url: 'https://example.invalid/cpr', description: '跟著節拍器練每分鐘 100～120 下', sort_order: 0 },
  { id: 'p2', title: '急救情境解謎', url: 'https://example.invalid/puzzle', description: '五個情境，看你會怎麼處理', sort_order: 1 },
]

export default function StudentHome({ student, isPreview, healthEnabled }: {
  student: StudentProfile
  isPreview: boolean
  healthEnabled: boolean
}) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [links, setLinks] = useState<StudentLink[] | null>(isPreview ? PREVIEW_LINKS : null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (isPreview) return
    let cancelled = false
    myLinks()
      .then((ls) => { if (!cancelled) setLinks(ls) })
      // 連結載不出來不該擋住作業：印一行字，上面的作業照樣按得到
      .catch(() => { if (!cancelled) { setLinks([]); setFailed(true) } })
    return () => { cancelled = true }
  }, [isPreview])

  return (
    <GlassPage>
      <div className="mx-auto flex max-w-[520px] flex-col gap-6 px-4 pb-16 pt-5">
        <header className="glass flex items-center gap-3.5 rounded-[28px] p-[18px]">
          <div className="glass-tile flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] text-2xl font-bold text-white">
            {Array.from(student.name)[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-mist-mute">你好</div>
            <div className="text-[22px] font-bold leading-tight">{student.name}</div>
            <div className="mt-0.5 text-[13px] leading-normal text-mist-mute">
              {student.class_name} 班・座號 {student.seat_no ?? '—'}
              <br />
              {student.academic_year} 學年度第 {student.semester} 學期
            </div>
            {isPreview && (
              <div className="mt-1.5 inline-block rounded bg-[#FDF3E3] px-2 py-0.5 text-[12px] font-bold text-[#8A5310]">
                預覽模式・不會儲存
              </div>
            )}
          </div>
          <button
            onClick={() => (isPreview ? navigate('/demo') : void signOut())}
            className="glass flex h-11 min-w-14 shrink-0 items-center justify-center rounded-[22px] px-3.5 text-[13px] font-medium"
          >
            {isPreview ? '離開預覽' : '登出'}
          </button>
        </header>

        <section className="flex flex-col gap-2.5">
          <SectionTitle aside={healthEnabled ? `共 ${TASKS.length} 項` : undefined}>我的作業</SectionTitle>
          {healthEnabled ? (
            TASKS.map((t) => (
              <Link key={t.to} to={isPreview ? `${t.to}/preview` : t.to} className={CARD}>
                <div className="glass-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white">
                  <Icon d={t.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold leading-snug">{t.label}</div>
                  <p className="text-[13px] leading-normal text-mist-mute">{t.desc}</p>
                </div>
                <Icon d="M9 6l6 6-6 6" size={20} stroke={2.2} className="shrink-0 text-mist-main" />
              </Link>
            ))
          ) : (
            <div className={NOTE}>
              這門課沒有健康管理作業。如果你另外一門課有，用同一個帳號進來就看得到。
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionTitle>課程活動</SectionTitle>
          {links === null ? (
            <div className={NOTE}>載入中…</div>
          ) : links.length === 0 ? (
            <div className={NOTE}>
              {failed
                ? '課程活動一時載不出來，重新整理看看。上面的作業不受影響。'
                : '老師還沒有放課程活動。'}
            </div>
          ) : (
            links.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className={CARD}>
                <div className="glass-tile-alt flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white">
                  <Icon d={LINK_ICON} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold leading-snug">{l.title}</div>
                  {l.description && (
                    <p className="text-[13px] leading-normal text-mist-mute">{l.description}</p>
                  )}
                </div>
                <Icon d="M7 17L17 7M9 7h8v8" size={18} stroke={2.2} className="shrink-0 text-mist-main" />
                <span className="sr-only">（另開分頁）</span>
              </a>
            ))
          )}
        </section>
      </div>
    </GlassPage>
  )
}
