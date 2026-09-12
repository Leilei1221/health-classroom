import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { listClasses } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { listFlagged, type FlaggedStudent } from '../api'
import type { ClassRow } from '../../lib/types'

/**
 * 教師端紅旗查詢頁（最小版）。
 *
 * 這一頁只讀，沒有任何寫入資料庫的動作——沒有「已關懷、可清除」，
 * 旗子維持是黏的。那是下一輪的事，這輪先讓紅旗有人看得到。
 */
export default function FlagList() {
  const { student, teacher } = useAuth()
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [rows, setRows] = useState<FlaggedStudent[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listClasses()
      .then(async (cs) => {
        if (cancelled) return
        setClasses(cs)
        const active = cs.filter((c) => c.is_active)
        if (active.length === 0) { setRows([]); return }
        // 學期字串與登記頁的 semesterKey() 同一個組法
        const semesters = [...new Set(active.map((c) => `${c.academic_year}-${c.semester}`))]
        const flagged = await listFlagged(semesters)
        if (!cancelled) setRows(flagged)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [])

  if (error) return <Shell><Box tone="error">{error}</Box></Shell>
  if (classes === null) return <Shell><Box>載入中…</Box></Shell>

  /*
    擋人的條件用「有沒有帶班級」，不是用 role。
    有幾個學生帳號因為早期登入順序的關係在 hc_teachers 裡有一列，
    只看 role 會把他們當成老師放進來；而「帶班級」正好也是 RLS
    判斷讀得到誰的同一個條件，兩邊不會各說各話。
  */
  if (classes.length === 0) {
    return (
      <Shell>
        <Box tone="error">
          <strong className="mb-1 block">這一頁是健護老師用的</strong>
          {student ? (
            <>
              你的帳號在學生名單上（{student.class_name} 班・座號 {student.seat_no ?? '—'}）。
              要填自己的資料請到 <Link to="/health" className="font-medium underline">健康登記頁</Link>。
            </>
          ) : (
            <>這個帳號沒有帶任何班級，看不到學生資料。如果你是健護老師，請跟系統管理者確認班級設定。</>
          )}
        </Box>
      </Shell>
    )
  }

  return (
    <Shell subtitle={`${teacher?.display_name ?? ''}　${classes.filter((c) => c.is_active).length} 個班級`}>
      {rows === null ? (
        <Box>載入中…</Box>
      ) : rows.length === 0 ? (
        <Box>
          目前沒有需要關心的學生。
          <span className="mt-1 block text-xs text-slate-500">
            學生每送出一份量表就會重新判定；這一頁只顯示這學期的結果。
          </span>
        </Box>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">共 {rows.length} 位</span>
            {rows.some((r) => r.level === 'critical') && (
              <span className="rounded-md bg-[#A8403C] px-2 py-0.5 text-xs font-bold text-white">
                其中 {rows.filter((r) => r.level === 'critical').length} 位最優先
              </span>
            )}
          </div>

          {/* 手機：一人一張卡。表格在 390px 會被擠到每個字一行，讀不了 */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <div
                key={r.student_email + r.semester}
                className={`rounded-xl border px-3.5 py-3 ${
                  r.level === 'critical'
                    ? 'border-[#E7C4C2] bg-[#FBEDEC]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge level={r.level} />
                  <span className="ml-auto text-xs tabular-nums text-slate-500">{when(r.updated_at)}</span>
                </div>
                <div className="mb-1.5 text-[15px]">
                  <span className="text-slate-500">{r.class_name ?? '—'} 班　{r.seat_no ?? '—'} 號</span>
                  <Who row={r} className="ml-2 font-semibold" />
                </div>
                <Reasons rows={r.reasons} />
              </div>
            ))}
          </div>

          {/* 電腦：表格 */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">標記</th>
                  <th className="px-3 py-2 font-medium">班級</th>
                  <th className="px-3 py-2 font-medium">座號</th>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">觸發的量表</th>
                  <th className="px-3 py-2 font-medium">最後更新</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.student_email + r.semester}
                    className={`border-b border-slate-100 last:border-0 ${
                      r.level === 'critical' ? 'bg-[#FBEDEC]' : ''
                    }`}
                  >
                    <td className="px-3 py-3 align-top"><Badge level={r.level} /></td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">{r.class_name ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums">{r.seat_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 align-top"><Who row={r} className="font-medium" /></td>
                    <td className="px-3 py-3 align-top"><Reasons rows={r.reasons} /></td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-xs tabular-nums text-slate-500">
                      {when(r.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 text-xs leading-relaxed text-slate-600">
        <p>
          <strong className="mr-1.5 text-[#A8403C]">● 最優先</strong>
          情緒自我檢視表第 20 題「我想要消失不見」勾選過。這個標記不看總分，
          而且勾過之後即使重做也不會消失。
        </p>
        <p>
          <strong className="mr-1.5 text-[#8A5310]">▲ 留意</strong>
          分數落在需要關心的區間：心情溫度計 10 分以上、壓力偵測站 6 項以上、
          情緒自我檢視表 12 分以上。
        </p>
        <p>這一頁只能看，還不能標記「已關懷」。清除功能在下一版。</p>
      </div>
    </Shell>
  )
}

function Badge({ level }: { level: FlaggedStudent['level'] }) {
  return level === 'critical' ? (
    <span className="inline-flex whitespace-nowrap rounded-md bg-[#A8403C] px-2 py-1 text-xs font-bold text-white">
      ● 最優先
    </span>
  ) : (
    <span className="inline-flex whitespace-nowrap rounded-md border border-[#D19A2E] px-2 py-1 text-xs font-medium text-[#8A5310]">
      ▲ 留意
    </span>
  )
}

/** 對不到名單（換過信箱、或已從名單移除）才退回顯示帳號 */
function Who({ row, className = '' }: { row: FlaggedStudent; className?: string }) {
  return row.name
    ? <span className={className}>{row.name}</span>
    : <span className="font-mono text-xs text-slate-500">{row.student_email}</span>
}

function Reasons({ rows }: { rows: FlaggedStudent['reasons'] }) {
  return (
    <>
      {rows.map((x, i) => (
        <div key={i} className={i > 0 ? 'mt-0.5' : ''}>
          <span className="font-medium">{x.scale}</span>
          <span className="text-slate-500">　{x.detail}</span>
        </div>
      ))}
    </>
  )
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-semibold">需要關心的學生</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">班級管理</Link>
          <button onClick={() => void signOut()} className="text-sm text-slate-500 hover:text-slate-900">
            登出
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5">{children}</main>
    </div>
  )
}

function Box({ tone, children }: { tone?: 'error'; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-[#E7C4C2] bg-[#FBEDEC] text-[#A8403C]'
        : 'border-slate-200 bg-white text-slate-600'
    }`}>
      {children}
    </div>
  )
}
