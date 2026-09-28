import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { myLinks } from '../lib/api'
import type { StudentLink, StudentProfile } from '../lib/types'

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

const TASKS: { to: string; label: string; desc: string }[] = [
  { to: '/health/register', label: '身體數值登記', desc: '身高、體重、血壓等，量完當場填' },
  { to: '/health/selfcheck', label: '課本自我檢測', desc: '課本上的量表，填完看自己的結果' },
  { to: '/health/plate', label: '我的餐盤', desc: '記錄六大類食物吃了幾份' },
  { to: '/health/analysis', label: '健康分析', desc: '把你填的數值換成看得懂的話' },
  { to: '/health/goal', label: 'SMART 目標', desc: '訂一個這學期做得到的目標' },
  { to: '/health/checkin', label: '第一週打卡', desc: '目標訂好之後的七天紀錄' },
]

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
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-16">
        <header className="bg-[#0B4A44] px-5 pb-5 pt-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-bold tracking-wide">{student.name}</div>
              <div className="mt-0.5 text-[13px] opacity-70">
                {student.class_name} 班・座號 {student.seat_no ?? '—'}・
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
              className="-m-2 shrink-0 p-2 text-[13px] opacity-70 hover:opacity-100"
            >
              {isPreview ? '離開預覽' : '登出'}
            </button>
          </div>
        </header>

        <section className="px-3 pt-4">
          <h2 className="mb-2 px-1 text-[13px] font-bold tracking-widest text-[#4A6461]">
            我的作業
          </h2>
          {healthEnabled ? (
            <div className="space-y-2">
              {TASKS.map((t) => (
                <Link
                  key={t.to}
                  to={isPreview ? `${t.to}/preview` : t.to}
                  className="flex items-center gap-3 rounded-xl border border-[#C7E2DC] bg-white px-4 py-3.5 transition active:bg-[#F7FCFB]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{t.label}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[#4A6461]">{t.desc}</p>
                  </div>
                  <span aria-hidden className="shrink-0 text-[#12776E]">›</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[13px] leading-relaxed text-[#4A6461]">
              這門課沒有健康管理作業。如果你另外一門課有，用同一個帳號進來就看得到。
            </div>
          )}
        </section>

        <section className="px-3 pt-5">
          <h2 className="mb-2 px-1 text-[13px] font-bold tracking-widest text-[#4A6461]">
            課程活動
          </h2>
          {links === null ? (
            <div className="rounded-xl border border-[#C7E2DC] bg-white px-4 py-3.5 text-[13px] text-[#4A6461]">
              載入中…
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[13px] leading-relaxed text-[#4A6461]">
              {failed
                ? '課程活動一時載不出來，重新整理看看。上面的作業不受影響。'
                : '老師還沒有放課程活動。'}
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-[#C7E2DC] bg-white px-4 py-3.5 transition active:bg-[#F7FCFB]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{l.title}</div>
                    {l.description && (
                      <p className="mt-0.5 text-[13px] leading-relaxed text-[#4A6461]">
                        {l.description}
                      </p>
                    )}
                  </div>
                  <span aria-hidden className="shrink-0 text-[13px] text-[#4A6461]">另開分頁 ↗</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
