import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import GroupSeatMap, { type SeatOccupant } from '../components/GroupSeatMap'
import { Button, ErrorBox, Spinner, inputClass } from '../components/ui'
import { claimSeat, seatPickingInfo } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { SeatPickingInfo } from '../lib/types'

/**
 * 學生選位頁（免登入）。
 * 所有資料存取都經過帶 join_code 的 RPC，anon 角色對資料表沒有任何權限。
 */
export default function SeatPicking() {
  const { code = '' } = useParams()
  const [info, setInfo] = useState<SeatPickingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentId, setStudentId] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [done, setDone] = useState<{ group: number; slot: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setInfo(await seatPickingInfo(code))
      setError('')
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => { void load() }, [load])

  const pick = async (groupNo: number, seatSlot: number) => {
    if (!studentId) { setError('請先在上方選擇你的名字'); return }
    setBusy(true); setError('')
    try {
      await claimSeat(code, studentId, groupNo, seatSlot, studentNo || undefined)
      setDone({ group: groupNo, slot: seatSlot })
      await load()
    } catch (e) {
      setError(friendlyError(e))
      await load() // 位子被搶走時，重新整理座位圖
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  if (!info) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBox message={error || '無法載入選位資訊'} />
      </div>
    )
  }

  const nameOf = (id: string) => info.students.find((s) => s.id === id)?.name ?? ''
  const mySeat = info.occupied.find((o) => o.student_id === studentId)

  const occupants: SeatOccupant[] = info.occupied.map((o) => ({
    group_no: o.group_no,
    seat_slot: o.seat_slot,
    label: nameOf(o.student_id),
    state: o.student_id === studentId ? 'mine' : 'taken',
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-16">
      <header className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">{info.class.name} — 座位登記</h1>
        <p className="text-sm text-slate-500">先選你的名字，再點一個空位</p>
      </header>

      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-sm text-emerald-800">
          已完成登記：第 {done.group} 組 第 {done.slot} 個位子。想換位可以直接再點其他空位。
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">你的名字</span>
          <select
            className={inputClass}
            value={studentId}
            onChange={(e) => { setStudentId(e.target.value); setDone(null); setError('') }}
          >
            <option value="">— 請選擇 —</option>
            {info.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.seat_no ? `${s.seat_no}. ` : ''}{s.name}
                {info.occupied.some((o) => o.student_id === s.id) ? '（已選位）' : ''}
              </option>
            ))}
          </select>
        </label>

        {info.class.require_student_no && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">學號後三碼</span>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={3}
              placeholder="例：101"
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
            />
          </label>
        )}

        {mySeat && (
          <p className="text-sm text-emerald-700">
            你目前的位子：第 {mySeat.group_no} 組 第 {mySeat.seat_slot} 個
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <GroupSeatMap
          groupCount={info.class.group_count}
          groupCapacity={info.class.group_capacity}
          capacityOverrides={info.class.group_capacity_overrides}
          occupants={occupants}
          onSelect={busy ? undefined : pick}
        />
      </div>

      <div className="text-center">
        <Button variant="secondary" onClick={() => void load()} disabled={busy}>
          重新整理座位圖
        </Button>
      </div>
    </div>
  )
}
