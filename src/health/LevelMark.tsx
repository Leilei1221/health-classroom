/**
 * 分級色點。顏色之外再用形狀區分（綠＝圓、黃＝三角、橘＝菱形、紅＝方形），
 * 綠與橘的亮度幾乎一樣、黃色在淺底上偏淡，單靠顏色色盲的同學會分不出來。
 * 旁邊一律有文字標籤，這裡是輔助，所以不給螢幕閱讀器念。
 */
const LEVEL_MARK: Record<string, { fill: string; stroke: string; shape: 'circle' | 'triangle' | 'diamond' | 'square' }> = {
  g: { fill: '#2E8B62', stroke: '#1F6B49', shape: 'circle' },
  y: { fill: '#D19A2E', stroke: '#8A5A0C', shape: 'triangle' },
  o: { fill: '#B26A12', stroke: '#7A460B', shape: 'diamond' },
  r: { fill: '#9A3834', stroke: '#6F2420', shape: 'square' },
}

export default function LevelMark({ level, size = 12 }: { level: string; size?: number }) {
  const m = LEVEL_MARK[level]
  if (!m) return null
  const common = { fill: m.fill, stroke: m.stroke, strokeWidth: 1, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="shrink-0">
      {m.shape === 'circle' && <circle cx="6" cy="6" r="5" {...common} />}
      {m.shape === 'triangle' && <polygon points="6,1 11.2,10.6 0.8,10.6" {...common} />}
      {m.shape === 'diamond' && <polygon points="6,0.8 11.2,6 6,11.2 0.8,6" {...common} />}
      {m.shape === 'square' && <rect x="1.2" y="1.2" width="9.6" height="9.6" rx="1.6" {...common} />}
    </svg>
  )
}
