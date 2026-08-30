import { useEffect, useState } from 'react'
import GroupSeatMap, { type SeatOccupant } from './GroupSeatMap'
import QrCode from './QrCode'
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
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const onSeatClick = async (groupNo: number, seatSlot: number) => {
    const occupant = seats.find((s) => s.group_no === groupNo && s.seat_slot === seatSlot)
    try {
      if (moving) {
        await assignSeat(cls.id, moving, groupNo, seatSlot)
        setMoving(null)
        reload()
      } else if (occupant) {
        // 點已有人的位子＝選取該生準備調位
        setMoving(occupant.student_id)
      }
    } catch (e) {
      setError(friendlyError(e))
      reload()
    }
  }

  const unseated = students.filter((s) => !seats.some((x) => x.student_id === s.id))
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? '（已移除）'

  const occupants: SeatOccupant[] = seats.map((s) => ({
    group_no: s.group_no,
    seat_slot: s.seat_slot,
    label: nameOf(s.student_id),
    state: s.student_id === moving ? 'selected' : 'taken',
  }))

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            學生選位：{cls.seat_picking_open ? '開放中' : '已關閉'}
            <span className="ml-2 text-slate-400">
              {cls.group_count} 組 · 每組 {cls.group_capacity} 人
            </span>
          </p>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{pickUrl}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(pickUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? '已複製 ✓' : '複製連結'}
        </Button>
        <Button variant="secondary" onClick={() => setShowQr(true)}>顯示 QR code</Button>
        <Button onClick={togglePicking}>
          {cls.seat_picking_open ? '關閉選位' : '開放選位'}
        </Button>
      </div>

      {showQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="選位 QR code"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
          onClick={() => setShowQr(false)}
        >
          <div
            className="max-w-lg space-y-4 rounded-2xl bg-white p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{cls.name} 座位登記</h3>
            {!cls.seat_picking_open && (
              <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                選位目前尚未開放，學生掃了也無法選位。
              </p>
            )}
            <div className="flex justify-center">
              <QrCode value={pickUrl} size={280} />
            </div>
            <p className="break-all font-mono text-xs text-slate-500">{pickUrl}</p>
            <p className="text-sm text-slate-600">請同學用手機掃描，或直接開啟上面的連結</p>
            <Button variant="secondary" onClick={() => setShowQr(false)}>關閉</Button>
          </div>
        </div>
      )}

      {moving && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="flex-1">正在調整「{nameOf(moving)}」的座位，請點選目標位子。</span>
          <Button variant="ghost" onClick={() => setMoving(null)}>取消</Button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <GroupSeatMap
          groupCount={cls.group_count}
          groupCapacity={cls.group_capacity}
          occupants={occupants}
          onSelect={onSeatClick}
        />
        <p className="mt-4 text-center text-xs text-slate-500">
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
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
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
