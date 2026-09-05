import { capacityFor, groupLayout, splitRows, toneFor, type CapacityOverrides } from '../lib/seating'

export type SeatState = 'empty' | 'taken' | 'mine' | 'selected'

/** 點名模式下用來標示出缺席；未點名為 unmarked */
export type SeatTone = 'unmarked' | 'present' | 'late' | 'absent' | 'leave' | 'official'

export interface SeatOccupant {
  group_no: number
  seat_slot: number
  label: string
  state: SeatState
  /** 出缺席底色；有給就蓋過 state 的樣式（selected 仍優先） */
  tone?: SeatTone
  /** 座位上的小標籤，例：遲、曠 */
  badge?: string
  /** 座位下方的小字，例：加扣分 */
  sublabel?: string
}

interface Props {
  groupCount: number
  groupCapacity: number
  /** 個別組別的加位，例：{"6": 6} 代表第 6 組 6 人 */
  capacityOverrides?: CapacityOverrides
  occupants: SeatOccupant[]
  onSelect?: (groupNo: number, seatSlot: number) => void
  /** 顯示每組人數統計 */
  showCounts?: boolean
}

const SEAT_BASE =
  'relative flex h-16 w-[4.75rem] flex-col items-center justify-center rounded-xl border text-center transition'

/** 每個位子的高度（rem），桌子高度需與座位欄對齊 */
const SEAT_H = 4
const SEAT_GAP = 0.5

const TONE_STYLE: Record<SeatTone, string> = {
  unmarked: 'border-slate-200 bg-slate-50 text-slate-500',
  present: 'border-slate-300 bg-white text-slate-800 shadow-sm',
  late: 'border-amber-400 bg-amber-50 text-amber-900',
  absent: 'border-red-400 bg-red-50 text-red-900',
  leave: 'border-sky-400 bg-sky-50 text-sky-900',
  official: 'border-violet-400 bg-violet-50 text-violet-900',
}

const BADGE_STYLE: Record<SeatTone, string> = {
  unmarked: 'bg-slate-200 text-slate-600',
  present: 'bg-slate-200 text-slate-700',
  late: 'bg-amber-500 text-white',
  absent: 'bg-red-500 text-white',
  leave: 'bg-sky-500 text-white',
  official: 'bg-violet-500 text-white',
}

function Seat({
  occupant, groupNo, slot, onSelect,
}: {
  occupant?: SeatOccupant
  groupNo: number
  slot: number
  onSelect?: (g: number, s: number) => void
}) {
  const state: SeatState = occupant?.state ?? 'empty'
  const clickable = Boolean(onSelect)

  const stateStyle = {
    empty: 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-slate-500 hover:text-slate-600',
    taken: 'border-slate-300 bg-white text-slate-800 shadow-sm',
    mine: 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200',
    selected: 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200',
  }[state]

  // selected 代表「正在操作中」，必須看得出來，因此優先於出缺席底色
  const style =
    state === 'selected' || !occupant?.tone ? stateStyle : TONE_STYLE[occupant.tone]

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onSelect?.(groupNo, slot)}
      aria-label={`第 ${groupNo} 組 第 ${slot} 位${occupant ? `：${occupant.label}` : '：空位'}`}
      className={`${SEAT_BASE} ${style} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {occupant ? (
        <>
          {occupant.badge && (
            <span
              className={`absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                BADGE_STYLE[occupant.tone ?? 'unmarked']
              }`}
            >
              {occupant.badge}
            </span>
          )}
          <span className="w-full truncate px-1 text-sm font-medium leading-tight">
            {occupant.label}
          </span>
          {occupant.sublabel && (
            <span className="mt-0.5 truncate px-1 text-[10px] leading-none opacity-70">
              {occupant.sublabel}
            </span>
          )}
        </>
      ) : (
        <span className="text-xs">空位</span>
      )}
    </button>
  )
}

function GroupDesk({
  groupNo, capacity, occupants, onSelect, showCounts,
}: {
  groupNo: number
  capacity: number
  occupants: SeatOccupant[]
  onSelect?: (g: number, s: number) => void
  showCounts?: boolean
}) {
  const { left, right, end } = groupLayout(capacity)
  const tone = toneFor(groupNo)
  const at = (slot: number) => occupants.find((o) => o.group_no === groupNo && o.seat_slot === slot)
  const seated = occupants.filter((o) => o.group_no === groupNo).length

  const rows = Math.max(left.length, right.length)

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ${tone.ring}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.chip}`}>
          第 {groupNo} 組
        </span>
        {showCounts && (
          <span className="text-xs text-slate-400">{seated}/{capacity}</span>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        {/* 左側 ─ 桌子 ─ 右側 */}
        <div className="flex items-stretch gap-2">
          <div className="flex flex-col gap-2">
            {left.map((slot) => (
              <Seat key={slot} occupant={at(slot)} groupNo={groupNo} slot={slot} onSelect={onSelect} />
            ))}
          </div>

          <div
            className={`flex w-16 items-center justify-center rounded-xl border ${tone.desk}`}
            style={{ minHeight: `${rows * SEAT_H + (rows - 1) * SEAT_GAP}rem` }}
            aria-hidden="true"
          >
            <span className="text-[10px] font-medium tracking-widest text-slate-400">桌</span>
          </div>

          <div className="flex flex-col gap-2">
            {right.map((slot) => (
              <Seat key={slot} occupant={at(slot)} groupNo={groupNo} slot={slot} onSelect={onSelect} />
            ))}
          </div>
        </div>

        {/* 桌子後端 */}
        {end !== null && (
          <Seat occupant={at(end)} groupNo={groupNo} slot={end} onSelect={onSelect} />
        )}
      </div>
    </div>
  )
}

/**
 * 分組座位圖：上下兩排討論桌，每組 U 字型就座，講台在最上方。
 */
export default function GroupSeatMap({
  groupCount, groupCapacity, capacityOverrides, occupants, onSelect, showCounts = true,
}: Props) {
  const { top, bottom } = splitRows(groupCount)

  const row = (groups: number[]) => (
    <div className="flex flex-wrap justify-center gap-4">
      {groups.map((g) => (
        <GroupDesk
          key={g}
          groupNo={g}
          capacity={capacityFor(groupCapacity, capacityOverrides, g)}
          occupants={occupants}
          onSelect={onSelect}
          showCounts={showCounts}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="mx-auto max-w-md rounded-xl bg-slate-800 py-2 text-center text-xs font-medium tracking-[0.3em] text-white">
        講　台
      </div>
      {top.length > 0 && row(top)}
      {bottom.length > 0 && row(bottom)}
    </div>
  )
}
