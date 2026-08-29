import { useEffect, useState } from 'react'
import SeatMap, { type SeatCell } from './SeatMap'
import { Button, ErrorBox, Spinner } from './ui'
import { assignSeat, clearSeat, listSeats, listStudents, updateClass } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { ClassRow, SeatAssignment, Student } from '../lib/types'

export default function SeatPanel({ cls, onClassChange }: {
  cls: ClassRow
  onClassChange: (c: ClassRow) => void
}) {
  const [students, setStudents] = useState<Student[]>([])
  const [seats, setSeats] = useState<SeatAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [moving, setMoving] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    Promise.all([listStudents(cls.id), listSeats(cls.id)])
      .then(([st, se]) => { setStudents(st); setSeats(se) })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [cls.id])

  const pickUrl = `${window.location.origin}${window.location.pathname}#/seat/${cls.join_code}`

  const togglePicking = async () => {
    try {
      onClassChange(await updateClass(cls.id, { seat_picking_open: !cls.seat_picking_open }))
    } catch (e) { setError(friendlyError(e)) }
  }

  const onCellClick = async (row: number, col: number) => {
    const occupant = seats.find((s) => s.seat_row === row && s.seat_col === col)
    try {
      if (moving) {
        await assignSeat(cls.id, moving, row, col)
        setMoving(null)
      } else if (occupant) {
        // 點已有人的位子＝選取該生準備調位
        setMoving(occupant.student_id)
        return
      } else {
        return
      }
      reload()
    } catch (e) {
      setError(friendlyError(e))
      reload()
    }
  }

  const unseated = students.filter((s) => !seats.some((x) => x.student_id === s.id))
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? '（已移除）'

  const cells: SeatCell[] = [
    ...cls.disabled_seats.map((d) => ({ row: d.row, col: d.col, state: 'disabled' as const })),
    ...seats.map((s) => ({
      row: s.seat_row,
      col: s.seat_col,
      label: nameOf(s.student_id),
      sublabel: s.assigned_by === 'teacher' ? '老師調位' : undefined,
      state: (s.student_id === moving ? 'mine' : 'taken') as SeatCell['state'],
    })),
  ]

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            學生選位：{cls.seat_picking_open ? '開放中' : '已關閉'}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{pickUrl}</p>
        </div>
        <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(pickUrl)}>
          複製連結
        </Button>
        <Button onClick={togglePicking}>
          {cls.seat_picking_open ? '關閉選位' : '開放選位'}
        </Button>
      </div>

      {moving && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="flex-1">正在調整「{nameOf(moving)}」的座位，請點選目標位子。</span>
          <Button variant="ghost" onClick={() => setMoving(null)}>取消</Button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <SeatMap rows={cls.seat_rows} cols={cls.seat_cols} cells={cells} onSelect={onCellClick} />
        <p className="mt-3 text-xs text-slate-500">
          點有人的位子可選取該生調位；選取後再點空位即完成調動。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium">尚未選位（{unseated.length}）</h3>
        {unseated.length === 0 ? (
          <p className="text-sm text-slate-500">全班都已完成選位。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unseated.map((s) => (
              <button
                key={s.id}
                onClick={() => setMoving(s.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  moving === s.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 bg-white hover:border-slate-500'
                }`}
              >
                {s.seat_no ? `${s.seat_no}. ` : ''}{s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {seats.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-medium">清除座位</h3>
          <div className="flex flex-wrap gap-2">
            {seats.map((s) => (
              <button
                key={s.id}
                onClick={async () => {
                  try { await clearSeat(cls.id, s.student_id); reload() }
                  catch (e) { setError(friendlyError(e)) }
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-red-400 hover:text-red-700"
              >
                {nameOf(s.student_id)} ✕
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
