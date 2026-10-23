import type { ReactNode } from 'react'

/**
 * 學生端頁面的底：霧藍漸層加三團柔光。
 * 柔光固定在視窗上，內容捲動時背景不動，玻璃卡片才有東西可以「透」。
 */
export default function GlassPage({ children }: { children: ReactNode }) {
  return (
    <div className="glass-page relative min-h-screen text-mist-ink">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-16 h-[300px] w-[300px] rounded-full blur-[36px]"
          style={{ background: 'radial-gradient(circle, #afc3d9 0%, rgb(175 195 217 / 0) 70%)' }}
        />
        <div
          className="absolute -right-28 top-1/3 h-[320px] w-[320px] rounded-full blur-[36px]"
          style={{ background: 'radial-gradient(circle, #c3cce0 0%, rgb(195 204 224 / 0) 70%)' }}
        />
        <div
          className="absolute -bottom-16 -left-20 h-[300px] w-[300px] rounded-full blur-[36px]"
          style={{ background: 'radial-gradient(circle, #bccfd6 0%, rgb(188 207 214 / 0) 70%)' }}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}
