/**
 * 分組座位的幾何規則。
 *
 * 每組是一張討論桌，學生沿桌邊 U 字型就座：左側、右側，以及桌子後端（遠離講台）。
 * 標準每組 5 人 → 左 2、右 2、後端 1。
 *
 * seat_slot 為 1 起算的連續整數；此處決定它落在 U 的哪一段，
 * 資料庫只負責保證同組內不重複。
 */
export interface GroupLayout {
  left: number[]
  right: number[]
  end: number | null
}

export function groupLayout(capacity: number): GroupLayout {
  const cap = Math.max(1, Math.floor(capacity))
  // 3 人以上才留一個後端位，否則全部分到兩側
  const hasEnd = cap >= 3
  const sideTotal = hasEnd ? cap - 1 : cap
  const leftCount = Math.ceil(sideTotal / 2)

  const left = Array.from({ length: leftCount }, (_, i) => i + 1)
  const right = Array.from({ length: sideTotal - leftCount }, (_, i) => leftCount + i + 1)
  return { left, right, end: hasEnd ? cap : null }
}

/**
 * 分兩排擺放，與教室實際佈置一致：上排較少、下排較多。
 * 7 組 → 上 3 下 4；8 組 → 上 4 下 4。
 */
export function splitRows(groupCount: number): { top: number[]; bottom: number[] } {
  const n = Math.max(1, Math.floor(groupCount))
  const topCount = Math.floor(n / 2)
  const top = Array.from({ length: topCount }, (_, i) => i + 1)
  const bottom = Array.from({ length: n - topCount }, (_, i) => topCount + i + 1)
  return { top, bottom }
}

/** 組別配色，讓每組在視覺上可區分 */
export const GROUP_TONES = [
  { ring: 'ring-sky-200', chip: 'bg-sky-100 text-sky-800', desk: 'bg-sky-50 border-sky-200' },
  { ring: 'ring-emerald-200', chip: 'bg-emerald-100 text-emerald-800', desk: 'bg-emerald-50 border-emerald-200' },
  { ring: 'ring-amber-200', chip: 'bg-amber-100 text-amber-800', desk: 'bg-amber-50 border-amber-200' },
  { ring: 'ring-violet-200', chip: 'bg-violet-100 text-violet-800', desk: 'bg-violet-50 border-violet-200' },
  { ring: 'ring-rose-200', chip: 'bg-rose-100 text-rose-800', desk: 'bg-rose-50 border-rose-200' },
  { ring: 'ring-teal-200', chip: 'bg-teal-100 text-teal-800', desk: 'bg-teal-50 border-teal-200' },
  { ring: 'ring-indigo-200', chip: 'bg-indigo-100 text-indigo-800', desk: 'bg-indigo-50 border-indigo-200' },
  { ring: 'ring-orange-200', chip: 'bg-orange-100 text-orange-800', desk: 'bg-orange-50 border-orange-200' },
  { ring: 'ring-cyan-200', chip: 'bg-cyan-100 text-cyan-800', desk: 'bg-cyan-50 border-cyan-200' },
  { ring: 'ring-lime-200', chip: 'bg-lime-100 text-lime-800', desk: 'bg-lime-50 border-lime-200' },
  { ring: 'ring-fuchsia-200', chip: 'bg-fuchsia-100 text-fuchsia-800', desk: 'bg-fuchsia-50 border-fuchsia-200' },
  { ring: 'ring-slate-200', chip: 'bg-slate-100 text-slate-800', desk: 'bg-slate-50 border-slate-200' },
]

export function toneFor(groupNo: number) {
  return GROUP_TONES[(groupNo - 1) % GROUP_TONES.length]
}
