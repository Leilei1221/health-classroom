/**
 * 分組座位的幾何規則。
 *
 * 每組是一張討論桌，學生沿桌邊 U 字型就座：左側、右側，以及桌子後端（遠離講台）。
 * 標準每組 5 人 → 左 2、右 2、後端 1。
 * 需要加位時（例：309 班第 6 組 6 人）多的位子接在右側，
 * 原本的 5 個位置與 seat_slot 對應關係不變，已經坐好的人不會被挪動。
 *
 * seat_slot 為 1 起算的連續整數；此處決定它落在 U 的哪一段，
 * 資料庫只負責保證同組內不重複。
 */
export interface GroupLayout {
  left: number[]
  right: number[]
  /** 桌子後端（遠離講台）的位置 */
  end: number | null
}

/** 每組人數上限的個別覆寫，鍵為組號字串 */
export type CapacityOverrides = Record<string, number> | null | undefined

export function capacityFor(
  baseCapacity: number, overrides: CapacityOverrides, groupNo: number,
): number {
  const v = overrides?.[String(groupNo)]
  return typeof v === 'number' && v > 0 ? Math.floor(v) : baseCapacity
}

/** 標準 U 字型的座位數；超過的部分視為加位 */
const BASE_LAYOUT_CAPACITY = 5

export function groupLayout(capacity: number): GroupLayout {
  const cap = Math.max(1, Math.floor(capacity))
  const base = Math.min(cap, BASE_LAYOUT_CAPACITY)
  // 3 人以上才留一個後端位，否則全部分到兩側
  const hasEnd = base >= 3
  const sideTotal = hasEnd ? base - 1 : base
  const leftCount = Math.ceil(sideTotal / 2)

  const left = Array.from({ length: leftCount }, (_, i) => i + 1)
  const right = Array.from({ length: sideTotal - leftCount }, (_, i) => leftCount + i + 1)
  // 加位接在右側，不動既有的 seat_slot 對位
  for (let slot = base + 1; slot <= cap; slot += 1) right.push(slot)

  return { left, right, end: hasEnd ? base : null }
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

/** 單組人數上限的硬上限，避免資料異常時把座位圖撐爆 */
const MAX_GROUP_CAPACITY = 8

/**
 * 班級人數超過 組數 × 每組上限 時，自動把後排的組別加位。
 *
 * 例：309 班 36 人、7 組 × 5 人 = 35，少 1 位 → 第 6 組擴充為 6 人。
 * 加位順序優先後排的第 6、第 5 組，再往後排其他組、最後才動上排。
 *
 * minCapacities 用來保護「已經有人坐在加出來的位子上」的組別：
 * 即使人數變少也不會把那個位子收掉，否則座位圖會少畫一格、把人藏起來。
 */
export function planGroupCapacities(input: {
  groupCount: number
  baseCapacity: number
  studentCount: number
  /** 組號 → 該組目前已被佔用的最大 seat_slot */
  minCapacities?: Record<number, number>
}): Record<string, number> {
  const groupCount = Math.max(1, Math.floor(input.groupCount))
  const base = Math.max(1, Math.floor(input.baseCapacity))
  const caps = new Map<number, number>()

  for (let g = 1; g <= groupCount; g += 1) {
    const floor = input.minCapacities?.[g] ?? 0
    caps.set(g, Math.min(MAX_GROUP_CAPACITY, Math.max(base, floor)))
  }

  const total = () => [...caps.values()].reduce((a, b) => a + b, 0)
  const { bottom, top } = splitRows(groupCount)
  // 後排優先第 6、第 5 組，其餘後排照序，最後才輪到上排
  const order = [
    ...[6, 5].filter((g) => bottom.includes(g)),
    ...bottom.filter((g) => g !== 5 && g !== 6),
    ...top,
  ]

  // 依序輪流加位，人數再多也不會全部堆到同一組
  let guard = groupCount * MAX_GROUP_CAPACITY
  let i = 0
  while (total() < input.studentCount && guard > 0) {
    guard -= 1
    if (order.every((x) => (caps.get(x) ?? 0) >= MAX_GROUP_CAPACITY)) break
    const g = order[i % order.length]
    i += 1
    if ((caps.get(g) ?? 0) < MAX_GROUP_CAPACITY) caps.set(g, (caps.get(g) ?? 0) + 1)
  }

  const overrides: Record<string, number> = {}
  for (const [g, cap] of caps) if (cap !== base) overrides[String(g)] = cap
  return overrides
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
