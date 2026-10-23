import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import GroupSeatMap, { type SeatOccupant } from '../components/GroupSeatMap'
import GlassPage from '../components/GlassPage'
import { ErrorBox, Spinner } from '../components/ui'
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

  if (loading) return <GlassPage><Spinner /></GlassPage>

  if (!info) {
    return (
      <GlassPage>
        <div className="mx-auto max-w-md p-6">
          <ErrorBox message={error || '無法載入選位資訊'} />
        </div>
      </GlassPage>
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
    <GlassPage>
      <div className="mx-auto flex max-w-md flex-col gap-3.5 px-4 pb-16 pt-5">
        <header className="glass flex flex-col items-center gap-1 rounded-[28px] px-4 py-[18px] text-center">
          <h1 className="text-[22px] font-bold leading-snug">{info.class.name}　座位登記</h1>
          <p className="text-sm text-mist-mute">先選你的名字，再點一個空位</p>
        </header>

        {done && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-3xl border border-white/85 bg-gradient-to-br from-[#d6e2ee]/90 to-[#c2d0e1]/65 px-4 py-3.5 text-sm leading-relaxed shadow-[0_10px_30px_rgb(50_70_100/0.14),inset_0_1px_0_rgb(255_255_255/0.95)] backdrop-blur-[22px]"
          >
            <div className="glass-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
            <p>
              <strong>已完成登記：第 {done.group} 組 第 {done.slot} 個位子。</strong>
              想換位可以直接再點其他空位。
            </p>
          </div>
        )}

        {error && <ErrorBox message={error} />}

        <div className="glass flex flex-col gap-2.5 rounded-3xl p-4">
          <label className="block">
            <span className="mb-2.5 block text-sm font-bold">你的名字</span>
            <div className="relative">
              <select
                className={FIELD + ' appearance-none pr-11'}
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
              <svg className="pointer-events-none absolute right-3.5 top-3.5 text-mist-main" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </label>

          {info.class.require_student_no && (
            <label className="block">
              <span className="mb-2.5 block text-sm font-bold">學號後三碼</span>
              <input
                className={FIELD}
                inputMode="numeric"
                maxLength={3}
                placeholder="例：101"
                value={studentNo}
                onChange={(e) => setStudentNo(e.target.value)}
              />
            </label>
          )}

          {mySeat && (
            <p className="text-sm font-medium text-mist-deep">
              你目前的位子：第 {mySeat.group_no} 組 第 {mySeat.seat_slot} 個
            </p>
          )}
        </div>

        <div className="glass rounded-3xl p-3.5">
          <GroupSeatMap
            variant="glass"
            groupCount={info.class.group_count}
            groupCapacity={info.class.group_capacity}
            capacityOverrides={info.class.group_capacity_overrides}
            occupants={occupants}
            onSelect={busy ? undefined : pick}
          />
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="glass flex h-12 items-center justify-center gap-2 rounded-3xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-mist-main">
            <path d="M20 11a8 8 0 0 0-14.5-4.5M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5M20 20v-4h-4" />
          </svg>
          重新整理座位圖
        </button>
      </div>
    </GlassPage>
  )
}

/** 玻璃風格的輸入欄位：高度 48px，手機上好點、字級 16px 避免 iOS 自動放大 */
const FIELD =
  'h-12 w-full rounded-2xl border border-mist-main/40 bg-white/85 px-4 text-base text-mist-ink outline-none focus:border-mist-main focus:ring-2 focus:ring-mist-light/50'
