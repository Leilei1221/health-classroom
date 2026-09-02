import { Button } from './ui'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus,
  PerformanceItem, PerformanceRecord, Student,
} from '../lib/types'

/**
 * 座位圖模式下的單一學生點名視窗。
 * 出缺席與加扣分都立即寫入資料庫，老師在教室裡點完就能離開。
 */
export default function SeatAttendanceDialog({
  student, seatLabel, attendance, statuses, items, records,
  onSetStatus, onAddRecord, onRemoveRecord, onClose, busy,
}: {
  student: Student
  seatLabel: string
  attendance?: AttendanceRow
  statuses: AttendanceStatus[]
  items: PerformanceItem[]
  records: PerformanceRecord[]
  onSetStatus: (code: AttendanceCode) => void
  onAddRecord: (item: PerformanceItem) => void
  onRemoveRecord: (id: string) => void
  onClose: () => void
  busy: boolean
}) {
  const mine = records.filter((r) => r.student_id === student.id)
  const total = mine.reduce((n, r) => n + Number(r.points), 0)
  const current = attendance?.status

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${student.name} 點名`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              {student.seat_no ? `${student.seat_no}. ` : ''}{student.name}
            </h3>
            <p className="text-xs text-slate-500">{seatLabel}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>關閉</Button>
        </div>

        <section className="mb-5">
          <h4 className="mb-2 text-sm font-medium text-slate-700">出缺席</h4>
          <div className="grid grid-cols-3 gap-2">
            {statuses.map((st) => (
              <button
                key={st.code}
                disabled={busy}
                onClick={() => onSetStatus(st.code)}
                className={`rounded-lg border px-2 py-2 text-sm transition disabled:opacity-50 ${
                  current === st.code
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                }`}
              >
                {st.label}
                {Number(st.default_points) !== 0 && (
                  <span className="ml-1 text-xs opacity-70">{st.default_points}</span>
                )}
              </button>
            ))}
          </div>
          {!current && (
            <p className="mt-2 text-xs text-slate-500">尚未點名，選一個狀態即會立即儲存。</p>
          )}
        </section>

        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-700">上課表現</h4>
            <span className={`text-sm font-semibold ${
              total > 0 ? 'text-emerald-700' : total < 0 ? 'text-red-700' : 'text-slate-400'
            }`}>
              本堂 {total > 0 ? `+${total}` : total}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((it) => (
              <button
                key={it.id}
                disabled={busy}
                onClick={() => onAddRecord(it)}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition disabled:opacity-50 ${
                  it.default_points >= 0
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {it.label} {it.default_points > 0 ? '+' : ''}{it.default_points}
              </button>
            ))}
          </div>
        </section>

        {mine.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-medium text-slate-700">本堂已記錄</h4>
            <div className="flex flex-wrap gap-1.5">
              {mine.map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => onRemoveRecord(r.id)}
                  title="點擊移除這筆紀錄"
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                >
                  {r.label} {Number(r.points) > 0 ? '+' : ''}{r.points} ✕
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
