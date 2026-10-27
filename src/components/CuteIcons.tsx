import type { ReactNode } from 'react'

/**
 * 教師後台用的可愛小圖：粗邊、粉彩填色的貓咪臉，每個功能一隻不同花色的貓。
 * 全部是 56×56 的原創 SVG，顏色對應 tailwind 的 cute 色票。
 */
const INK = '#3A3535'
const PINK = '#F4B5AE'
const GREEN = '#BFE3A8'
const PEACH = '#F9C79B'
const CREAM = '#FDF8EC'

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

/** 貓頭：兩隻尖耳朵（內側粉色）、頭形；臉上的表情由 children 畫 */
function Cat({ fill = '#fff', children }: { fill?: string; children: ReactNode }) {
  return (
    <>
      <path
        d="M10 25 L8.5 8.5 Q8.5 6.5 10.5 7.5 L21.5 14 Q28 12.5 34.5 14 L45.5 7.5 Q47.5 6.5 47.5 8.5 L46 25 Q50.5 31 48.5 39 Q44.5 50 28 50 Q11.5 50 7.5 39 Q5.5 31 10 25Z"
        fill={fill}
      />
      <path d="M12 12.5 L18.5 16 L12.5 21Z" fill={PINK} stroke="none" />
      <path d="M44 12.5 L37.5 16 L43.5 21Z" fill={PINK} stroke="none" />
      {children}
    </>
  )
}

const EYE_L = 20.5
const EYE_R = 35.5

/** 圓眼、小鼻子、小嘴、腮紅。eyes 可換成別的眼睛（閉眼、眨眼…） */
function Face({ eyes, nose = INK }: { eyes?: ReactNode; nose?: string }) {
  return (
    <>
      {eyes ?? (
        <>
          <circle cx={EYE_L} cy="32" r="1.9" fill={INK} stroke="none" />
          <circle cx={EYE_R} cy="32" r="1.9" fill={INK} stroke="none" />
        </>
      )}
      <path d="M26.5 36 h3 l-1.5 2z" fill={nose} strokeWidth="1.5" />
      <path d="M24.5 40 q3.5 3 3.5 0 q0 3 3.5 0" strokeWidth="2" />
      <circle cx="15" cy="38" r="3" fill={PINK} stroke="none" />
      <circle cx="41" cy="38" r="3" fill={PINK} stroke="none" />
    </>
  )
}

/** 開心閉眼（^ ^） */
const happyEyes = (
  <>
    <path d={`M${EYE_L - 3} 33 q3 -4 6 0`} />
    <path d={`M${EYE_R - 3} 33 q3 -4 6 0`} />
  </>
)

/** 點名：戴圓眼鏡的白貓 */
export function ClipboardIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <Cat>
        <Face
          eyes={
            <>
              <circle cx={EYE_L} cy="32" r="1.9" fill={INK} stroke="none" />
              <circle cx={EYE_R} cy="32" r="1.9" fill={INK} stroke="none" />
              <circle cx={EYE_L} cy="32" r="6" strokeWidth="1.8" />
              <circle cx={EYE_R} cy="32" r="6" strokeWidth="1.8" />
              <path d="M26.5 31.5 h3" strokeWidth="1.8" />
            </>
          }
        />
      </Cat>
    </Svg>
  )
}

/** 健康：額頭有愛心的三花貓，開心閉眼 */
export function HeartIcon({ size = 56, fill = '#fff' }: { size?: number; fill?: string }) {
  return (
    <Svg size={size}>
      <Cat fill={fill}>
        <path d="M28 27 C21 23 22 18 25 18.5 C26.5 18.8 27.6 20 28 21 C28.4 20 29.5 18.8 31 18.5 C34 18 35 23 28 27Z" fill={PINK} strokeWidth="1.8" />
        <Face eyes={happyEyes} />
      </Cat>
    </Svg>
  )
}

/** 螢幕教學：灰貓眨一隻眼 */
export function MonitorIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <Cat fill="#CFC9C4">
        <Face
          eyes={
            <>
              <circle cx={EYE_L} cy="32" r="1.9" fill={INK} stroke="none" />
              <path d={`M${EYE_R - 3} 29.5 l5 2.5 -5 2.5`} strokeWidth="2" />
            </>
          }
        />
      </Cat>
    </Svg>
  )
}

/** 成長：頭上長出嫩芽的暹羅貓（臉中間深色） */
export function SproutIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M28 14 V7" />
      <path d="M28 9 C21 10 18 5 20 1.5 C26 1.5 29 5 28 9Z" fill={GREEN} strokeWidth="2" />
      <path d="M28 8 C28 3 32 0.5 37 1.5 C38 7 34 10 28 8Z" fill={GREEN} strokeWidth="2" />
      <Cat fill="#E6D2B0">
        <ellipse cx="28" cy="37" rx="12" ry="9.5" fill="#B79F82" stroke="none" />
        <Face
          eyes={happyEyes}
          nose={INK}
        />
      </Cat>
    </Svg>
  )
}

/** 健康防護：黑貓，額頭有粉紅十字 */
export function ShieldIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <Cat fill="#5A5252">
        <path d="M26.5 17 h3 v3.5 h3.5 v3 h-3.5 v3.5 h-3 v-3.5 h-3.5 v-3 h3.5z" fill={PINK} stroke="none" />
        <Face
          eyes={
            <>
              <circle cx={EYE_L} cy="32" r="3" fill={CREAM} strokeWidth="1.8" />
              <circle cx={EYE_R} cy="32" r="3" fill={CREAM} strokeWidth="1.8" />
              <circle cx={EYE_L} cy="32" r="1.2" fill={INK} stroke="none" />
              <circle cx={EYE_R} cy="32" r="1.2" fill={INK} stroke="none" />
            </>
          }
          nose={PINK}
        />
        <path d="M24.5 40 q3.5 3 3.5 0 q0 3 3.5 0" stroke={CREAM} strokeWidth="2" />
      </Cat>
    </Svg>
  )
}

/** 行事曆：橘白花貓，開心閉眼 */
export function CalendarIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg size={size}>
      <Cat>
        <path d="M10 25 L8.5 8.5 Q8.5 6.5 10.5 7.5 L21.5 14 L24 24 Q16 28 10 25Z" fill={PEACH} stroke="none" />
        <path d="M12 12.5 L18.5 16 L12.5 21Z" fill={PINK} stroke="none" />
        <path d="M46 25 L47.5 8.5 Q47.5 6.5 45.5 7.5 L38 11.5 L35 22 Q41 26 46 25Z" fill="#7A706C" stroke="none" />
        <path d="M44 12.5 L37.5 16 L43.5 21Z" fill={PINK} stroke="none" />
        <path
          d="M10 25 L8.5 8.5 Q8.5 6.5 10.5 7.5 L21.5 14 Q28 12.5 34.5 14 L45.5 7.5 Q47.5 6.5 47.5 8.5 L46 25 Q50.5 31 48.5 39 Q44.5 50 28 50 Q11.5 50 7.5 39 Q5.5 31 10 25Z"
          fill="none"
        />
        <Face eyes={happyEyes} />
      </Cat>
    </Svg>
  )
}
