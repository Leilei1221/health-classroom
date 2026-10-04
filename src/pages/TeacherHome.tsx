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

      <p className="mb-4 text-sm text-slate-500">
        {teacher?.display_name ? `${teacher.display_name}老師，` : ''}
        目前有 {active.length} 個班級，其中 {health.length} 個班使用健康管理。
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          title="班級管理"
          desc="學生名單、點名、座位表、課堂表現與作業紀錄。"
          to="/classes"
          cta="開啟班級列表"
        />

        <Card
          title="健康管理"
          desc="學生填的身體數值、自我檢測與 SMART 目標。"
          to="/health/progress"
          cta="班級進度"
          more={[
            { to: '/health/detail', label: '學生明細' },
            { to: '/health/review', label: 'SMART 與行動批改' },
            { to: '/health/teacher', label: '需要關心的學生' },
          ]}
          foot={
            <button onClick={() => setQr(true)} className="text-sm text-slate-500 underline hover:text-slate-900">
              學生入口 QR code
            </button>
          }
        />

        <Card
          title="示範區"
          desc="上課投影用的示範畫面，不會寫入任何資料。"
          to="/demo"
          cta="開啟示範區"
        />

        <Card
          title="學生端內容管理"
          desc="貼一個網址，學生入口就長出一張卡（CPR 節奏、情境解謎等）。"
          to="/links"
          cta="管理課程活動連結"
        />

        <Card
          title="急救王國・遊戲後台"
          desc="急救王國遊戲的學生進度、班級開關（開放章節）與發布天災。會另開新分頁，要在那一頁再登入一次。"
          href="https://leilei1221.github.io/first-aid-kingdom/teacher.html"
          cta="開啟遊戲後台 ↗"
        />
      </div>

      {qr && <HealthQrDialog onClose={() => setQr(false)} />}
    </Layout>
  )
}

function Card({ title, desc, to, href, cta, more, foot }: {
  title: string
  desc: string
  to?: string
  href?: string  // 外部網址：另開新分頁（急救王國後台是另一個網站）
  cta: string
  more?: { to: string; label: string }[]
  foot?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {cta}
          </a>
        ) : (
          <Link
            to={to ?? '/'}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {cta}
          </Link>
        )}
        {more?.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {m.label}
          </Link>
        ))}
      </div>
      {foot && <div>{foot}</div>}
    </section>
  )
}
