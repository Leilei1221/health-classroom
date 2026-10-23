import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import HealthQrDialog from '../components/HealthQrDialog'
import { ErrorBox } from '../components/ui'
import { listClasses } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow } from '../lib/types'

/*
  L3 提示放在首頁最上方是規格書第五節教師端明文要求的位置。
  入口頁取代了原本的班級列表當首頁，所以這個提示也跟著搬過來——
  它要在「一登入就看到」的那一頁，不是在某個分頁裡。

  lazy 載入：沒有紅旗的老師（多數情況）不必為了一個不會顯示的東西多下載一份程式。
*/
const L3Alert = lazy(() => import('../health/teacher/L3Alert'))

/**
 * 教師入口頁。
 *
 * 蕾蕾 9/27：「我覺得頁面有點混亂……想把它們整合起來變成一個入口網站」。
 * 原本班級列表右上角擠了十個按鈕，點名、健康管理、預覽混在一起。
 * 這一頁把它們分成四區，各自進到自己的地方；班級列表移到 /classes。
 *
 * 這一頁不讀任何學生資料（班級清單只是拿來給 L3 提示算學期），
 * 所以投影出來只有標題與按鈕。真正有姓名的是 L3 提示，
 * 它自己有「上課投影時先收起」。
 */
export default function TeacherHome() {
  const { teacher } = useAuth()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [error, setError] = useState('')
  const [qr, setQr] = useState(false)

  useEffect(() => {
    listClasses().then(setClasses).catch((e) => setError(friendlyError(e)))
  }, [])

  const active = classes.filter((c) => c.is_active)
  const health = active.filter((c) => c.health_enabled)

  return (
    <Layout title="健康與護理・教師後台">
      <Suspense fallback={null}><L3Alert classes={classes} /></Suspense>

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <p className="mb-4 px-1.5 text-sm leading-relaxed text-mist-mute">
        {teacher?.display_name ? `${teacher.display_name}老師，` : ''}
        目前有 {active.length} 個班級，其中 {health.length} 個班使用健康管理。
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card
          title="班級管理"
          icon={ICONS.users}
          wide
          desc="學生名單、點名、座位表、課堂表現與作業紀錄。"
          to="/classes"
          cta="開啟班級列表"
        />

        <Card
          title="健康管理"
          icon={ICONS.pulse}
          wide
          desc="學生填的身體數值、自我檢測與 SMART 目標。"
          to="/health/progress"
          cta="班級進度"
          more={[
            { to: '/health/detail', label: '學生明細' },
            { to: '/health/review', label: 'SMART 與行動批改' },
            { to: '/health/teacher', label: '需要關心的學生' },
          ]}
          foot={
            <button onClick={() => setQr(true)} className="flex min-h-11 items-center text-sm text-mist-deep underline underline-offset-4 hover:text-mist-ink">
              學生入口 QR code
            </button>
          }
        />

        <Card
          title="示範區"
          icon={ICONS.screen}
          desc="上課投影用的示範畫面，不會寫入任何資料。"
          to="/demo"
          cta="開啟示範區"
        />

        <Card
          title="學生端內容管理"
          icon={ICONS.link}
          desc="貼一個網址，學生入口就長出一張卡（CPR 節奏、情境解謎等）。"
          to="/links"
          cta="管理課程活動連結"
        />

        <Card
          title="急救王國・遊戲後台"
          icon={ICONS.shield}
          external
          desc="急救王國遊戲的學生進度、班級開關（開放章節）與發布天災。會另開新分頁，要在那一頁再登入一次。"
          href="https://leilei1221.github.io/first-aid-kingdom/teacher.html"
          cta="開啟遊戲後台 ↗"
        />

        <Card
          title="會議簽到與紀錄"
          icon={ICONS.calendar}
          external
          desc="建立會議、iPad 手寫簽名或掃 QR code 簽到、簡易會議紀錄與匯出。會另開新分頁，要在那一頁用 Google 再登入一次。"
          href="https://leilei1221.github.io/meeting-checkin/"
          cta="開啟會議簽到 ↗"
        />
      </div>

      {qr && <HealthQrDialog onClose={() => setQr(false)} />}
    </Layout>
  )
}

const ICONS = {
  users: 'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  pulse: 'M3 12h4l2.5-6 4 12 2.5-6H21',
  screen: 'M3 5h18v11H3zM8 21h8M12 16v5',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM12 9v6M9 12h6',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
}

const BTN = 'flex h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition'
const BTN_MAIN = `${BTN} bg-gradient-to-br from-[#6F8FAF] to-mist-main text-white shadow-[0_6px_14px_rgb(79_111_146/0.32),inset_0_1px_0_rgb(255_255_255/0.45)] hover:brightness-105`
const BTN_SOFT = `${BTN} border border-mist-main/30 bg-white/70 text-mist-deep hover:bg-white`

function Card({ title, desc, icon, external, wide, to, href, cta, more, foot }: {
  title: string
  desc: string
  icon: string
  /** 另開新分頁的外部網站，圖示方塊用灰紫藍和站內功能區分 */
  external?: boolean
  /**
   * 平板以上橫跨兩欄、文字在左按鈕在右。兩張主要功能卡的按鈕數量差很多
   * （一顆對四顆加連結），並排時較短那張會被拉高、中間空一大塊。
   */
  wide?: boolean
  to?: string
  href?: string  // 外部網址：另開新分頁（急救王國後台是另一個網站）
  cta: string
  more?: { to: string; label: string }[]
  foot?: React.ReactNode
}) {
  const actions = (
    <>
      <div className={`mt-auto flex flex-wrap items-center gap-2 ${wide ? 'sm:mt-0 sm:justify-end' : ''}`}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={BTN_MAIN}>
            {cta}
          </a>
        ) : (
          <Link to={to ?? '/'} className={BTN_MAIN}>
            {cta}
          </Link>
        )}
        {more?.map((m) => (
          <Link key={m.to} to={m.to} className={BTN_SOFT}>
            {m.label}
          </Link>
        ))}
      </div>
      {foot && <div>{foot}</div>}
    </>
  )

  return (
    <section
      className={`glass flex flex-col gap-3.5 rounded-[26px] p-[18px] ${
        wide ? 'sm:col-span-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6' : ''
      }`}
    >
      <div className="flex items-start gap-3.5 sm:flex-1">
        <div className={`${external ? 'glass-tile-alt' : 'glass-tile'} flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={icon} />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold leading-snug">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mist-mute">{desc}</p>
        </div>
      </div>
      {wide ? (
        <div className="flex flex-col gap-1 sm:max-w-[55%] sm:shrink-0 sm:items-end">{actions}</div>
      ) : (
        actions
      )}
    </section>
  )
}
