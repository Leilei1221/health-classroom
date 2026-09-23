import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRisk, type RiskStudent } from '../api'
import type { ClassRow } from '../../lib/types'

/**
 * 教師端首頁最上方的 L3 提示。
 *
 * 規格書第五節教師端：「L3 的學生要出現在最顯眼的位置——教師端首頁最上方，
 * 不是藏在某個分頁裡」，顯示班級、座號、姓名、觸發時間。
 * 「未處理的 L3 不會自動消失」：這裡只列未標記已聯繫的，標記完才會不見，
 * 沒有任何「知道了」之類的關閉鈕。
 *
 * 唯一的例外是下面那個「先收起」：上課投影班級管理頁時，姓名不該在布幕上。
 * 收起之後還是留著一行「有 N 位」，而且只記在 sessionStorage——
 * 關掉分頁就恢復，不會變成永久關掉這個提示。
 */
const HIDE_KEY = 'hc_l3_collapsed'

export default function L3Alert({ classes }: { classes: ClassRow[] }) {
  const [rows, setRows] = useState<RiskStudent[]>([])
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState(() => {
    try { return sessionStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })

  // 白名單班級才有健康模組，也才會有紅旗；semester 的組法與紅旗頁一致
  const semesters = [
    ...new Set(classes.filter((c) => c.health_enabled && c.is_active)
      .map((c) => `${c.academic_year}-${c.semester}`)),
  ].sort()
  const key = semesters.join(',')

  useEffect(() => {
    if (semesters.length === 0) { setRows([]); return }
    let cancelled = false
    listRisk(semesters)
      .then((rs) => {
        if (cancelled) return
        // 新觸發的排前面，與紅旗頁同一個順序
        setRows(rs.filter((r) => r.level === 3 && !r.reviewed)
          .sort((a, b) => (b.flaggedAt ?? '').localeCompare(a.flaggedAt ?? '')))
      })
      .catch(() => { if (!cancelled) setError('最高層級的提醒載入失敗，請到「需要關心的學生」確認') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  function toggle() {
    const v = !collapsed
    setCollapsed(v)
    try { sessionStorage.setItem(HIDE_KEY, v ? '1' : '0') } catch { /* 無痕視窗 */ }
  }

  if (error) {
    return (
      <div className="mb-4 rounded-xl border border-[#E7C4C2] bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">
        {error}
      </div>
    )
  }
  if (rows.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border-2 border-[#A8403C] bg-[#FBEDEC] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-md bg-[#A8403C] px-2 py-1 text-xs font-bold text-white">
          ● 立即
        </span>
        <strong className="text-[15px] text-[#A8403C]">
          有 {rows.length} 位學生需要今天處理
        </strong>
        <button onClick={toggle} className="text-xs text-[#A8403C] underline">
          {collapsed ? '展開' : '上課投影時先收起'}
        </button>
        <Link
          to="/health/teacher"
          className="ml-auto rounded-lg bg-[#A8403C] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#8F3532]"
        >
          前往處理
        </Link>
      </div>

      {!collapsed && (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.student_email + r.semester} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-slate-600">{r.class_name ?? '—'} 班　{r.seat_no ?? '—'} 號</span>
              <span className="font-semibold">{r.name ?? r.student_email}</span>
              {r.l3Count >= 2 && (
                <span className="rounded border border-[#A8403C] px-1 text-xs font-bold text-[#A8403C]">
                  重複觸發 {r.l3Count} 次
                </span>
              )}
              <span className="text-xs tabular-nums text-slate-500">觸發 {when(r.flaggedAt)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-[#8A5310]">
        標記「已聯繫」之後這一則才會消失。
      </p>
    </div>
  )
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('zh-TW', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'
