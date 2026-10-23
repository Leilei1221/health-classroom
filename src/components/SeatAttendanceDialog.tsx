import { Button } from './ui'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus,
  PerformanceItem, PerformanceRecord, Student,
} from '../lib/types'

const CHIP = 'flex min-h-11 items-center justify-center rounded-full text-sm font-medium transition disabled:opacity-50'

/**
 * 座位圖模式下的單一學生點名視窗。
 * 出缺席與加扣分都立即寫入資料庫，老師在教室裡點完就能離開。
 * 手機上從畫面底部升起，所有按鈕至少 44px 高，教室裡單手也按得準。
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2B3A4A]/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-white/90 px-[18px] pb-7 pt-2.5 sm:rounded-[32px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-mist-main/35 sm:hidden" />

        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold leading-snug">
              {student.seat_no ? `${student.seat_no}. ` : ''}{student.name}
            </h3>
            <p className="text-[13px] text-mist-mute">{seatLabel}</p>
          </div>
          <Button variant="secondary" onClick={onClose}>關閉</Button>
        </div>

        <section className="mb-[18px]">
          <h4 className="mb-2.5 text-sm font-bold text-mist-deep">出缺席</h4>
          <div className="grid grid-cols-3 gap-2">
            {statuses.map((st) => (
              <button
                key={st.code}
                disabled={busy}
                onClick={() => onSetStatus(st.code)}
                className={`${CHIP} gap-1 px-1.5 ${
                  current === st.code
                    ? 'border border-white/60 bg-gradient-to-br from-[#6F8FAF] to-mist-main text-white shadow-[0_6px_14px_rgb(79_111_146/0.32),inset_0_1px_0_rgb(255_255_255/0.45)]'
                    : 'border border-mist-main/30 bg-white/85 text-mist-ink hover:bg-white'
                }`}
              >
                {st.label}
                {Number(st.default_points) !== 0 && (
                  <span className="text-xs opacity-80">{st.default_points}</span>
                )}
              </button>
            ))}
          </div>
          {!current && (
            <p className="mt-2 text-xs text-mist-mute">尚未點名，選一個狀態即會立即儲存。</p>
          )}
        </section>

        <section className="mb-[18px]">
          <div className="mb-2.5 flex items-center justify-between">
            <h4 className="text-sm font-bold text-mist-deep">上課表現</h4>
            <span className={`text-sm font-bold ${
              total > 0 ? 'text-[#2F5B45]' : total < 0 ? 'text-[#7A3434]' : 'text-mist-mute'
            }`}>
              本堂 {total > 0 ? `+${total}` : total}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <button
                key={it.id}
                disabled={busy}
                onClick={() => onAddRecord(it)}
                className={`${CHIP} px-3 text-[13px] ${
                  it.default_points >= 0
                    ? 'bg-[#DCE8E2] text-[#2F5B45] hover:bg-[#cfe0d7]'
                    : 'bg-[#EBD4D4] text-[#7A3434] hover:bg-[#e3c7c7]'
                }`}
              >
                {it.label} {it.default_points > 0 ? '+' : ''}{it.default_points}
              </button>
            ))}
          </div>
        </section>

        {mine.length > 0 && (
          <section>
            <h4 className="mb-2.5 text-sm font-bold text-mist-deep">本堂已記錄</h4>
            <div className="flex flex-wrap gap-2">
              {mine.map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => onRemoveRecord(r.id)}
                  title="點擊移除這筆紀錄"
                  aria-label={`移除這筆紀錄：${r.label} ${Number(r.points) > 0 ? '+' : ''}${r.points}`}
                  className={`${CHIP} gap-1.5 bg-mist-main/10 px-3 text-[13px] text-mist-deep hover:bg-red-100 hover:text-[#7A3434]`}
                >
                  {r.label} {Number(r.points) > 0 ? '+' : ''}{r.points}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
