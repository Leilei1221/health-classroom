import type { ReactNode } from 'react'

/**
 * 教師後台用的可愛小圖：粗邊、粉彩填色、笑臉。
 * 全部是 56×56 的原創 SVG，顏色對應 tailwind 的 cute 色票。
 */
const INK = '#3A3535'
const PINK = '#F4B5AE'
const YELLOW = '#F8D768'
const GREEN = '#BFE3A8'
const PEACH = '#F9C79B'

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 56 56" fill="none" stroke={INK}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      {children}
    </svg>
  )
}

/** 笑臉：兩顆眼睛、微笑、兩團腮紅 */
function Face({ x, y, gap = 12 }: { x: number; y: number; gap?: number }) {
  const l = x - gap / 2
  const r = x + gap / 2
  return (
    <>
      <circle cx={l} cy={y} r="1.7" fill={INK} />
      <circle cx={r} cy={y} r="1.7" fill={INK} />
      <path d={`M${x - 3} ${y + 5} q3 3 6 0`} />
      <circle cx={l - 4} cy={y + 5} r="2.6" fill={PINK} stroke="none" />
      <circle cx={r + 4} cy={y + 5} r="2.6" fill={PINK} stroke="none" />
    </>
  )
}

export function ClipboardIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="11" y="9" width="34" height="40" rx="6" fill="#fff" />
      <rect x="20" y="4" width="16" height="10" rx="3" fill={YELLOW} />
      <Face x={28} y={29} />
    </Svg>
  )
}

export function HeartIcon({ size = 56, fill = '#fff' }: { size?: number; fill?: string }) {
  return (
    <Svg size={size}>
      <path d="M28 48 C9 35 7 21 14 15 C20 10 26 13 28 18 C30 13 36 10 42 15 C49 21 47 35 28 48Z" fill={fill} />
      <Face x={28} y={28} />
    </Svg>
  )
}

export function MonitorIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="9" width="44" height="31" rx="6" fill="#fff" />
      <rect x="11" y="14" width="34" height="21" rx="3" fill="#FDF8EC" />
      <path d="M20 47 h16 M28 40 v7" />
      <Face x={28} y={24} gap={10} />
    </Svg>
  )
}

export function SproutIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M15 34 h26 l-3 15 h-20z" fill={PEACH} />
      <path d="M28 34 V25" />
      <path d="M28 27 C18 28 15 20 17 14 C25 13 29 19 28 27Z" fill="#fff" />
      <path d="M28 25 C28 17 33 11 41 11 C43 19 38 26 28 25Z" fill="#fff" />
      <circle cx="23" cy="41" r="1.6" fill={INK} />
      <circle cx="33" cy="41" r="1.6" fill={INK} />
      <path d="M25 44 q3 2.5 6 0" />
    </Svg>
  )
}

export function ShieldIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M28 5 L47 12 V28 C47 38 39 45 28 50 C17 45 9 38 9 28 V12Z" fill="#fff" />
      <path d="M25 17 h6 v7 h7 v6 h-7 v7 h-6 v-7 h-7 v-6 h7z" fill={PINK} />
    </Svg>
  )
}

export function CalendarIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="7" y="11" width="42" height="38" rx="7" fill="#fff" />
      <path d="M7 22 h42" />
      <path d="M18 6 v10 M38 6 v10" />
      <rect x="13" y="27" width="30" height="16" rx="3" fill={GREEN} />
      <path d="M21 35 l5 5 9-10" />
    </Svg>
  )
}
