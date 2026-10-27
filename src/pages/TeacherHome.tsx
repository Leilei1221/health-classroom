import { Suspense, lazy, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Layout from '../components/Layout'
import HealthQrDialog from '../components/HealthQrDialog'
import {
  CalendarIcon, ClipboardIcon, HeartIcon, MonitorIcon, ShieldIcon, SproutIcon,
} from '../components/CuteIcons'
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

      <div className="cute-card mb-5 flex items-center gap-3 rounded-[20px] bg-cute-butter px-4 py-3">
        <span className="shrink-0"><ClipboardIcon size={44} /></span>
        <p className="text-sm leading-relaxed md:text-[15px]">
          {teacher?.display_name ? `${teacher.display_name}老師，` : ''}
          目前有 <b>{active.length}</b> 個班級，其中 <b>{health.length}</b> 個班使用健康管理。
        </p>
      </div>

      <h2 className="mb-3 px-1 text-lg font-bold">今天要做什麼</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="班級管理"
          icon={<ClipboardIcon />}
          tone="bg-cute-yellow"
          wide
          desc="學生名單、點名、座位表、課堂表現與作業紀錄。"
          to="/classes"
          cta="開啟班級列表"
        />

        <Card
          title="健康管理"
          icon={<HeartIcon />}
          tone="bg-cute-pink"
          wide
          desc="學生填的身體數值、自我檢測與 SMART 目標。"
          to="/health/progress"
          cta="班級進度"
          more={[
            { to: '/health/detail', label: '學生明細', tone: 'bg-cute-blue' },
            { to: '/health/review', label: 'SMART 與行動批改', tone: 'bg-cute-green' },
            { to: '/health/teacher', label: '需要關心的學生', tone: 'bg-cute-pink' },
          ]}
          foot={
            <button onClick={() => setQr(true)} className="flex min-h-11 items-center text-sm font-bold underline underline-offset-4 hover:text-cute-mute">
              學生入口 QR code
            </button>
          }
        />

        <Card
          title="示範區"
          icon={<MonitorIcon />}
          tone="bg-cute-blue"
          desc="上課投影用的示範畫面，不會寫入任何資料。"
          to="/demo"
          cta="開啟示範區"
        />

        <Card
          title="學生端內容管理"
          icon={<SproutIcon />}
          tone="bg-cute-green"
          desc="貼一個網址，學生入口就長出一張卡（CPR 節奏、情境解謎等）。"
          to="/links"
          cta="管理課程活動連結"
        />

        <Card
          title="急救王國・遊戲後台"
          icon={<ShieldIcon />}
          tone="bg-cute-lavender"
          desc="急救王國遊戲的學生進度、班級開關（開放章節）與發布天災。會另開新分頁，要在那一頁再登入一次。"
          href="https://leilei1221.github.io/first-aid-kingdom/teacher.html"
          cta="開啟遊戲後台 ↗"
        />

        <Card
          title="會議簽到與紀錄"
          icon={<CalendarIcon />}
          tone="bg-cute-peach"
          desc="建立會議、iPad 手寫簽名或掃 QR code 簽到、簡易會議紀錄與匯出。會另開新分頁，要在那一頁用 Google 再登入一次。"
          href="https://leilei1221.github.io/meeting-checkin/"
          cta="開啟會議簽到 ↗"
        />
      </div>

      {qr && <HealthQrDialog onClose={() => setQr(false)} />}
    </Layout>
  )
}

function Card({ title, desc, icon, tone, wide, to, href, cta, more, foot }: {
  title: string
  desc: string
  /** 56×56 的可愛小圖（CuteIcons） */
  icon: ReactNode
  /** 圖示方塊的底色，例：bg-cute-yellow */
  tone: string
  /**
   * iPad 以上橫跨兩欄、文字在左按鈕在右。兩張主要功能卡的按鈕數量差很多
   * （一顆對四顆加連結），並排時較短那張會被拉高、中間空一大塊。
   */
  wide?: boolean
  to?: string
  href?: string  // 外部網址：另開新分頁（急救王國後台是另一個網站）
  cta: string
  more?: { to: string; label: string; tone: string }[]
  foot?: ReactNode
}) {
  const actions = (
    <>
      <div className={`mt-auto flex flex-wrap items-center gap-2.5 ${wide ? 'md:mt-0 md:justify-end' : ''}`}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="cute-btn">
            {cta}
          </a>
        ) : (
          <Link to={to ?? '/'} className="cute-btn">
            {cta}
          </Link>
        )}
        {more?.map((m) => (
          <Link key={m.to} to={m.to} className={`cute-chip ${m.tone}`}>
            {m.label}
          </Link>
        ))}
      </div>
      {foot && <div>{foot}</div>}
    </>
  )

  return (
    <section
      className={`cute-card flex flex-col gap-3.5 rounded-3xl p-4 md:p-[18px] ${
        wide ? 'md:col-span-2 md:flex-row md:items-center md:justify-between md:gap-6' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 md:flex-1">
        <div className={`cute-block h-[68px] w-[68px] md:h-[72px] md:w-[72px] ${tone}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-snug md:text-xl">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-cute-mute md:text-sm">{desc}</p>
        </div>
      </div>
      {wide ? (
        <div className="flex flex-col gap-1 md:max-w-[55%] md:shrink-0 md:items-end">{actions}</div>
      ) : (
        actions
      )}
    </section>
  )
}
