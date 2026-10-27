import { Fragment } from 'react'
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
  /**
   * default：原本的樣式（教師端點名、調位用）。
   * glass：學生手機選位用，每排放兩組、座位縮小、莫蘭迪霧藍玻璃風格。
   * cute：教師後台（點名、座位圖管理）用，可愛貼紙風；寬螢幕分上下兩排，手機每排兩組。
   */
  variant?: 'default' | 'glass' | 'cute'
  /** glass 版型頂端的「空位／已被選／我的位子」圖例；點名用自己的圖例時關掉 */
  showLegend?: boolean
  /**
   * glass 版型的欄數：預設兩欄（學生手機與平板的窄容器）；
   * 容器夠寬的教師頁傳 true，寬螢幕改四欄。這裡看的是容器不是視窗，
   * 所以不能交給 md: 自動判斷——學生選位頁在平板上視窗很寬、容器卻只有 448px。
   */
  wide?: boolean
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

const GLASS_SEAT_STYLE: Record<SeatState, string> = {
  empty: 'border-[1.5px] border-dashed border-mist-main/60 bg-white/40 text-mist-mute',
  taken: 'border border-[#32465f]/20 bg-white/90 text-mist-ink shadow-[0_3px_8px_rgb(50_70_100/0.1)]',
  mine: 'border border-white/70 bg-gradient-to-br from-mist-light to-mist-main text-white shadow-[0_0_0_3px_rgb(127_157_187/0.38),0_6px_14px_rgb(79_111_146/0.4)]',
  // 點名時代表「正在操作這一位」：保留出缺席底色，外面多一圈藍框
  selected: 'ring-[3px] ring-mist-main/70 ring-offset-1 ring-offset-white',
}

/** 點名用的出缺席底色（莫蘭迪色系，文字與底色對比均 ≥ 4.5:1） */
const GLASS_TONE_STYLE: Record<SeatTone, string> = {
  unmarked: 'border-[1.5px] border-dashed border-mist-main/50 bg-white/35 text-mist-mute',
  present: 'border border-[#32465f]/20 bg-white/90 text-mist-ink',
  late: 'border border-[#C9B27A] bg-[#E8D9B8] text-[#6B5420]',
  absent: 'border border-[#C48C8C] bg-[#E3C4C4] text-[#7A3434]',
  leave: 'border border-[#8FB2CF] bg-[#C6DAEA] text-[#2E5878]',
  official: 'border border-[#A79CC9] bg-[#D5CDE6] text-[#4A3F78]',
}

const GLASS_BADGE_STYLE: Record<SeatTone, string> = {
  unmarked: 'bg-[#64748b]',
  present: 'bg-[#64748b]',
  late: 'bg-[#8A6414]',
  absent: 'bg-[#A04545]',
  leave: 'bg-[#3F6E96]',
  official: 'bg-[#6A5AA0]',
}

function GlassSeat({
  occupant, groupNo, slot, onSelect,
}: {
  occupant?: SeatOccupant
  groupNo: number
  slot: number
  onSelect?: (g: number, s: number) => void
}) {
  const state: SeatState = occupant?.state ?? 'empty'
  const base = occupant?.tone ? GLASS_TONE_STYLE[occupant.tone] : GLASS_SEAT_STYLE[state === 'selected' ? 'taken' : state]
  const style = state === 'selected' ? `${base} ${GLASS_SEAT_STYLE.selected}` : base
  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={() => onSelect?.(groupNo, slot)}
      aria-label={`第 ${groupNo} 組 第 ${slot} 位${occupant ? `：${occupant.label}` : '：空位'}${state === 'mine' ? '（我的位子）' : ''}`}
      className={`relative flex h-11 w-[50px] flex-col items-center justify-center rounded-[14px] px-0.5 text-center text-xs font-medium leading-tight transition ${style} ${onSelect ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
    >
      {occupant?.badge && (
        <span
          className={`absolute -right-[5px] -top-[5px] flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] border-white text-[10px] font-bold leading-none text-white ${GLASS_BADGE_STYLE[occupant.tone ?? 'unmarked']}`}
        >
          {occupant.badge}
        </span>
      )}
      <span className={`w-full break-all ${occupant?.sublabel ? 'line-clamp-1' : 'line-clamp-2'}`}>
        {occupant ? occupant.label : '空位'}
      </span>
      {occupant?.sublabel && <span className="text-[10px] opacity-85">{occupant.sublabel}</span>}
    </button>
  )
}

function GlassGroup({
  groupNo, capacity, occupants, onSelect, showCounts, className = '',
}: {
  groupNo: number
  capacity: number
  occupants: SeatOccupant[]
  onSelect?: (g: number, s: number) => void
  showCounts?: boolean
  className?: string
}) {
  const { left, right, end } = groupLayout(capacity)
  const at = (slot: number) => occupants.find((o) => o.group_no === groupNo && o.seat_slot === slot)
  const seated = occupants.filter((o) => o.group_no === groupNo).length
  const seat = (slot: number) => (
    <GlassSeat key={slot} occupant={at(slot)} groupNo={groupNo} slot={slot} onSelect={onSelect} />
  )

  return (
    <div className={`flex flex-col items-center gap-2 rounded-[20px] border border-white/75 bg-white/40 p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.9)] ${className}`}>
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full bg-mist-main/15 px-2.5 py-0.5 text-xs font-bold text-mist-deep">
          第 {groupNo} 組
        </span>
        {showCounts && <span className="text-xs text-mist-mute">{seated}/{capacity}</span>}
      </div>
      <div className="flex items-stretch gap-1.5">
        <div className="flex flex-col gap-1.5">{left.map(seat)}</div>
        <div
          aria-hidden="true"
          className="flex w-7 items-center justify-center rounded-[14px] border border-mist-main/20 bg-mist-main/10 text-[11px] text-mist-mute"
        >
          桌
        </div>
        <div className="flex flex-col gap-1.5">{right.map(seat)}</div>
      </div>
      {end !== null && seat(end)}
    </div>
  )
}

function GlassLegend() {
  const chip = 'inline-block h-3.5 w-3.5 rounded-[5px]'
  return (
    <div className="flex items-center justify-center gap-3.5 text-xs text-mist-mute">
      <span className="flex items-center gap-1.5">
        <span className={`${chip} border-[1.5px] border-dashed border-mist-main/60 bg-white/40`} />空位
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${chip} border border-[#32465f]/20 bg-white/90`} />已被選
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${chip} bg-gradient-to-br from-mist-light to-mist-main`} />我的位子
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- 教師後台（可愛貼紙風） */

const CUTE_TONE: Record<SeatTone, string> = {
  unmarked: 'border-dashed border-cute-ink/55 bg-cute-cream',
  present: 'border-cute-ink bg-white shadow-[1.5px_2px_0_#3A3535]',
  late: 'border-cute-ink bg-cute-yellow shadow-[1.5px_2px_0_#3A3535]',
  absent: 'border-cute-ink bg-cute-pink shadow-[1.5px_2px_0_#3A3535]',
  leave: 'border-cute-ink bg-cute-blue shadow-[1.5px_2px_0_#3A3535]',
  official: 'border-cute-ink bg-cute-lavender shadow-[1.5px_2px_0_#3A3535]',
}

function CuteSeat({
  occupant, groupNo, slot, onSelect,
}: {
  occupant?: SeatOccupant
  groupNo: number
  slot: number
  onSelect?: (g: number, s: number) => void
}) {
  const base = !occupant
    ? 'border-dashed border-cute-ink/55 bg-white text-cute-mute'
    : occupant.tone
      ? CUTE_TONE[occupant.tone]
      : 'border-cute-ink bg-white shadow-[1.5px_2px_0_#3A3535]'
  const selected = occupant?.state === 'selected'
  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={() => onSelect?.(groupNo, slot)}
      aria-label={`第 ${groupNo} 組 第 ${slot} 位${occupant ? `：${occupant.label}` : '：空位'}${occupant?.tone === 'unmarked' ? '，未點名' : ''}`}
      className={`relative flex h-[46px] w-[50px] flex-col items-center justify-center rounded-[13px] border-2 px-0.5 text-center text-xs font-bold leading-tight text-cute-ink transition ${base} ${
        selected ? 'ring-[3px] ring-[#4F8FC0] ring-offset-2 ring-offset-white' : ''
      } ${onSelect ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${!occupant ? '!text-cute-mute' : ''}`}
    >
      {occupant?.badge && (
        <span className="absolute -right-[7px] -top-[7px] flex h-[19px] w-[19px] items-center justify-center rounded-full bg-cute-ink text-[10px] font-bold leading-none text-white">
          {occupant.badge}
        </span>
      )}
      <span className={`w-full break-all ${occupant?.sublabel ? 'line-clamp-1' : 'line-clamp-2'}`}>
        {occupant ? occupant.label : '空位'}
      </span>
      {occupant?.sublabel && <span className="text-[10px]">{occupant.sublabel}</span>}
    </button>
  )
}

function CuteGroup({
  groupNo, capacity, occupants, onSelect, showCounts, className = '',
}: {
  groupNo: number
  capacity: number
  occupants: SeatOccupant[]
  onSelect?: (g: number, s: number) => void
  showCounts?: boolean
  className?: string
}) {
  const { left, right, end } = groupLayout(capacity)
  const at = (slot: number) => occupants.find((o) => o.group_no === groupNo && o.seat_slot === slot)
  const seated = occupants.filter((o) => o.group_no === groupNo).length
  const seat = (slot: number) => (
    <CuteSeat key={slot} occupant={at(slot)} groupNo={groupNo} slot={slot} onSelect={onSelect} />
  )
  return (
    <div className={`cute-inset flex flex-col items-center gap-2 rounded-[18px] px-2 py-2.5 ${className}`}>
      <div className="flex w-full items-center justify-between">
        <span className="rounded-full border-2 border-cute-ink bg-cute-yellow px-2.5 text-xs font-bold">第 {groupNo} 組</span>
        {showCounts && <span className="text-xs text-cute-mute">{seated}/{capacity}</span>}
      </div>
      <div className="flex items-stretch gap-[5px]">
        <div className="flex flex-col gap-[7px]">{left.map(seat)}</div>
        <div
          aria-hidden="true"
          className="flex w-5 items-center justify-center rounded-xl border-2 border-cute-ink bg-cute-sand text-[11px] text-cute-mute"
        >
          桌
        </div>
        <div className="flex flex-col gap-[7px]">{right.map(seat)}</div>
      </div>
      {end !== null && seat(end)}
    </div>
  )
}

/**
 * 分組座位圖：上下兩排討論桌，每組 U 字型就座，講台在最上方。
 */
export default function GroupSeatMap({
  groupCount, groupCapacity, capacityOverrides, occupants, onSelect, showCounts = true,
  variant = 'default', showLegend = true, wide = false,
}: Props) {
  if (variant === 'cute') {
    /*
      教師後台：照教室實際佈置分兩排，上排較少、下排較多
      （7 組＝上 3 下 4；8 組＝上 4 下 4），手機寬度每排兩組。
      用 flex 加換行標記而不是固定欄數的 grid，上排組數較少時才能置中。
    */
    const n = Math.max(1, Math.floor(groupCount))
    const topCount = splitRows(n).top.length
    return (
      <div className="flex flex-col gap-3">
        <div className="cute-chip mx-auto w-[70%] bg-cute-blue !min-h-10 tracking-[0.4em]">講　台</div>
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
          {Array.from({ length: n }, (_, i) => i + 1).map((g) => (
            <Fragment key={g}>
              <CuteGroup
                groupNo={g}
                capacity={capacityFor(groupCapacity, capacityOverrides, g)}
                occupants={occupants}
                onSelect={onSelect}
                showCounts={showCounts}
                className="w-[calc(50%-6px)] md:w-[calc((100%-36px)/4)]"
              />
              {g === topCount && <div aria-hidden className="hidden basis-full md:-my-1.5 md:block" />}
            </Fragment>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'glass') {
    // 手機寬度每排放兩組；組數是奇數時，最後一組置中
    const groups = Array.from({ length: Math.max(1, Math.floor(groupCount)) }, (_, i) => i + 1)
    const oddLast = groups.length % 2 === 1 ? groups[groups.length - 1] : null
    const topCount = splitRows(groupCount).top.length
    return (
      <div className="flex flex-col gap-3">
        <div className="mx-auto w-[70%] rounded-b-3xl rounded-t-2xl bg-mist-deep/90 py-2 text-center text-[13px] font-medium tracking-[0.4em] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
          講　台
        </div>
        {showLegend && <GlassLegend />}
        {wide ? (
          /*
            教師端寬螢幕：照教室實際佈置分兩排，上排較少、下排較多
            （7 組＝上 3 下 4；8 組＝上 4 下 4），和 splitRows 一致。
            手機寬度仍是每排兩組。用 flex 加換行標記，不用固定欄數的 grid，
            這樣上排 3 組可以置中，不會靠左留一格空位。
          */
          <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2.5">
            {groups.map((g) => (
              <Fragment key={g}>
                <GlassGroup
                  groupNo={g}
                  capacity={capacityFor(groupCapacity, capacityOverrides, g)}
                  occupants={occupants}
                  onSelect={onSelect}
                  showCounts={showCounts}
                  className="w-[calc(50%-5px)] md:w-[calc((100%-30px)/4)]"
                />
                {g === topCount && (
                  <div aria-hidden className="hidden basis-full md:-my-[5px] md:block" />
                )}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="mx-auto grid grid-cols-2 gap-2.5">
            {groups.map((g) => (
              <GlassGroup
                key={g}
                groupNo={g}
                capacity={capacityFor(groupCapacity, capacityOverrides, g)}
                occupants={occupants}
                onSelect={onSelect}
                showCounts={showCounts}
                className={g === oddLast ? 'col-span-2 w-[calc(50%-5px)] justify-self-center' : ''}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

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
