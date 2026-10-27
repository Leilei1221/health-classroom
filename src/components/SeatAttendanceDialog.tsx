import { ClipboardIcon } from './CuteIcons'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus,
  PerformanceItem, PerformanceRecord, Student,
} from '../lib/types'

/**
 * 座位圖模式下的單一學生點名。
 * 出缺席與加扣分都立即寫入資料庫，老師在教室裡點完就能離開。
 *
 * 兩種呈現，內容完全相同：
 * - modal：手機與窄螢幕，從畫面底部升起的視窗，所有按鈕至少 44px 高
 * - panel：iPad 橫向以上，固定在座位圖右側，點哪位就換成哪位，不用開關視窗
 */
export default function SeatAttendanceDialog({
  student, seatLabel, attendance, statuses, items, records,
  onSetStatus, onAddRecord, onRemoveRecord, onClose, busy, variant = 'modal',
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
  variant?: 'modal' | 'panel'
}) {
  const mine = records.filter((r) => r.student_id === student.id)
  const total = mine.reduce((n, r) => n + Number(r.points), 0)
  const current = attendance?.status
  const initial = Array.from(student.name)[0]

  const body = (
    <>
      <div className="mb-[18px] flex items-center gap-3">
        <div className="cute-block h-14 w-14 rounded-[18px] bg-cute-yellow text-2xl font-bold" aria-hidden>
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold leading-snug">
            {student.seat_no ? `${student.seat_no}. ` : ''}{student.name}
          </h3>
          <p className="text-[13px] text-cute-mute">{seatLabel}</p>
        </div>
        {variant === 'modal' && (
          <button onClick={onClose} className="cute-chip bg-white">關閉</button>
        )}
      </div>

      <section className="mb-[18px]">
        <h4 className="mb-2.5 text-sm font-bold">出缺席</h4>
        <div className="grid grid-cols-3 gap-2.5">
          {statuses.map((st) => (
            <button
              key={st.code}
              disabled={busy}
              onClick={() => onSetStatus(st.code)}
              aria-pressed={current === st.code}
              className={`cute-chip px-1.5 disabled:opacity-50 ${current === st.code ? 'bg-cute-yellow' : 'bg-white'}`}
            >
              {st.label}
              {Number(st.default_points) !== 0 && (
                <span className="text-xs">{st.default_points}</span>
              )}
            </button>
          ))}
        </div>
        {!current && (
          <p className="mt-2 text-xs text-cute-mute">尚未點名，選一個狀態即會立即儲存。</p>
        )}
      </section>

      <section className="mb-[18px]">
        <div className="mb-2.5 flex items-center justify-between">
          <h4 className="text-sm font-bold">上課表現</h4>
          <span className={`text-sm font-bold ${
            total > 0 ? 'text-[#2F5B45]' : total < 0 ? 'text-[#9A3834]' : 'text-cute-mute'
          }`}>
            本堂 {total > 0 ? `+${total}` : total}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {items.map((it) => (
            <button
              key={it.id}
              disabled={busy}
              onClick={() => onAddRecord(it)}
              className={`cute-chip !px-3 text-[13px] disabled:opacity-50 ${
                it.default_points >= 0 ? 'bg-cute-green' : 'bg-cute-pink'
              }`}
            >
              {it.label} {it.default_points > 0 ? '+' : ''}{it.default_points}
            </button>
          ))}
        </div>
      </section>

      {mine.length > 0 && (
        <section>
          <h4 className="mb-2.5 text-sm font-bold">本堂已記錄</h4>
          <div className="flex flex-wrap gap-2.5">
            {mine.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => onRemoveRecord(r.id)}
                title="點擊移除這筆紀錄"
                aria-label={`移除這筆紀錄：${r.label} ${Number(r.points) > 0 ? '+' : ''}${r.points}`}
                className="cute-chip gap-1.5 bg-cute-cream !px-3 text-[13px] disabled:opacity-50"
              >
                {r.label} {Number(r.points) > 0 ? '+' : ''}{r.points}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )

  if (variant === 'panel') {
    return (
      <aside aria-label={`${student.name} 點名`} className="cute-card rounded-3xl p-[18px]">
        {body}
      </aside>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${student.name} 點名`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-cute-ink/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="cute-card max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[32px] border-b-0 px-[18px] pb-7 pt-2.5 shadow-none sm:rounded-[32px] sm:border-b-[2.5px] sm:shadow-[4px_5px_0_#3A3535]"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-cute-ink/30 sm:hidden" />
        {body}
      </div>
    </div>
  )
}

/** 沒有選任何人時，面板顯示的提示 */
export function AttendancePanelEmpty() {
  return (
    <aside className="cute-card flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
      <ClipboardIcon size={64} />
      <p className="text-sm leading-relaxed text-cute-mute">點左邊的座位，在這裡點名、記加扣分。</p>
    </aside>
  )
}
