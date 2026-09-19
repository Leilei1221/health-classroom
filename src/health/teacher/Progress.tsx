import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { listClasses } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import {
  PROGRESS_TASKS, SCALE_TASK_KEYS, listProgress, type ProgressStudent,
} from '../api'
import type { ClassRow } from '../../lib/types'

/**
 * 班級進度表（唯讀）。
 *
 * 這一頁會投影給全班看，所以只顯示「做了 / 沒做」——
 * 沒有任何分數、沒有任何紅旗標記、沒有關懷文案。這一條沒有例外。
 *
 * 保證的方式不是「查回來但不顯示」，而是 listProgress() 根本不查：
 * 每一條查詢都只 select('student_email')，分數不會離開資料庫。
 * 所以就算之後有人想在這一頁加分數也加不出來，手上沒有資料。
 *
 * 紅旗要看哪些人，在另一頁 /health/teacher，那一頁只有老師自己看。
 */
export default function Progress() {
  const { student, teacher } = useAuth()
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [rows, setRows] = useState<ProgressStudent[] | null>(null)
  const [classId, setClassId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listClasses()
      .then(async (cs) => {
        if (cancelled) return
        setClasses(cs)
        const active = cs.filter((c) => c.is_active)
        if (active.length === 0) { setRows([]); return }
        setClassId((prev) => prev ?? active[0].id)
        const semesters = [...new Set(active.map((c) => `${c.academic_year}-${c.semester}`))]
        const all = await listProgress(semesters)
        if (!cancelled) setRows(all)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [])

  const active = useMemo(() => (classes ?? []).filter((c) => c.is_active), [classes])
  const mine = useMemo(
    () => (rows ?? []).filter((r) => r.class_id === classId),
    [rows, classId],
  )
  const allDone = mine.filter((r) => r.scalesDone === SCALE_TASK_KEYS.length).length
  const unfinished = mine.filter((r) => r.missing.length > 0)

  if (error) return <Shell><Box tone="error">{error}</Box></Shell>
  if (classes === null) return <Shell><Box>載入中…</Box></Shell>

  // 擋人條件與紅旗頁一致：看有沒有帶班級，與 RLS 同一套
  if (active.length === 0) {
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
            <>這個帳號沒有帶任何班級，看不到學生資料。</>
          )}
        </Box>
      </Shell>
    )
  }

  return (
    <Shell subtitle={teacher?.display_name}>
      {/* 班級切換 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {active.map((c) => (
          <button
            key={c.id}
            onClick={() => setClassId(c.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              c.id === classId
                ? 'bg-slate-900 font-bold text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.name}
          </button>
        ))}
        {/*
          去明細頁的入口。放在這裡而不是埋在頁尾，是因為上課中要查一個人
          不該先捲到最底下再找一行小字；帶著 ?class= 過去，落地就是同一個班。
          明細頁有分數，所以標上「不要投影」，樣式也刻意比班級按鈕淡，
          避免投影中誤觸。
        */}
        {classId && (
          <Link
            to={`/health/detail?class=${classId}`}
            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            學生明細 ›
            <span className="ml-1 text-xs text-slate-400">不要投影</span>
          </Link>
        )}
      </div>

      {rows === null ? (
        <Box>載入中…</Box>
      ) : mine.length === 0 ? (
        <Box>這個班的名單是空的。</Box>
      ) : (
        <>
          <div className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[15px]">
              <strong className="text-lg tabular-nums">{mine.length}</strong> 人，
              七份全做完 <strong className="text-lg tabular-nums">{allDone}</strong> 人
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              「七份」指七份量表，不含身體數值登記與我的餐盤
            </p>
          </div>

          {/* 手機：摘要＋還沒做完的人。上課時看的是這一份 */}
          <div className="sm:hidden">
            {unfinished.length === 0 ? (
              <Box>全班七份都做完了。</Box>
            ) : (
              <>
                <h2 className="mb-2 text-sm font-bold">
                  還沒做完的 {unfinished.length} 人
                </h2>
                <div className="space-y-2">
                  {unfinished.map((r) => (
                    <div key={r.student_id} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-sm tabular-nums text-slate-500">{r.seat_no ?? '—'} 號</span>
                        <span className="text-[15px] font-semibold">{r.name}</span>
                        <span className="ml-auto text-xs tabular-nums text-slate-500">
                          還差 {r.missing.length} 份
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-slate-600">
                        {r.missing.join('、')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 電腦：完整矩陣 */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[13px] text-slate-600">
                  <th className="px-3 py-2.5 text-left font-medium">座號</th>
                  <th className="px-3 py-2.5 text-left font-medium">姓名</th>
                  {PROGRESS_TASKS.map((t) => (
                    <th key={t.key} className="px-2 py-2.5 text-center font-medium" title={t.label}>
                      {t.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mine.map((r) => (
                  <tr key={r.student_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5 text-[15px] tabular-nums text-slate-500">{r.seat_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[15px] font-medium">{r.name}</td>
                    {PROGRESS_TASKS.map((t) => (
                      <td key={t.key} className="px-2 py-2.5 text-center">
                        {/* 要投影到布幕上，勾要夠大；沒做的用淡色方框而不是小點，遠看才分得出來 */}
                        {r.done[t.key] ? (
                          <span className="text-xl font-bold leading-none text-[#12776E]" aria-label="已完成">✓</span>
                        ) : (
                          <span className="text-xl leading-none text-slate-200" aria-label="尚未完成">□</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            這一頁只顯示做了沒有，不顯示任何分數或結果——可以直接投影。
            需要看誰要關心請到 <Link to="/health/teacher" className="underline">另一頁</Link>，
            要看同學填了什麼請到 <Link to="/health/detail" className="underline">學生明細</Link>
            （那兩頁都不要投影）。
          </p>
        </>
      )}
    </Shell>
  )
}

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-semibold">班級進度</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">班級管理</Link>
          <button onClick={() => void signOut()} className="text-sm text-slate-500 hover:text-slate-900">
            登出
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
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
