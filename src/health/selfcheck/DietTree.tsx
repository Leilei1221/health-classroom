import { useState } from 'react'
import { BackLink } from './Scale'
import { SCALES, type DietType } from './scales'

/**
 * 飲食金字塔決策樹（第 3 份）。
 * 分支完全依課本原始流程，未更動任何去向。
 */
export default function DietTree({ onFinish, onBack, saving }: {
  onFinish: (letter: DietType) => void
  onBack: () => void
  saving: boolean
}) {
  const s = SCALES.pyramid
  const tree = s.tree!
  const [node, setNode] = useState(1)
  const [history, setHistory] = useState<number[]>([])

  const choose = (next: number | DietType) => {
    setHistory((h) => [...h, node])
    if (typeof next === 'number') setNode(next)
    else onFinish(next)
  }

  const back = () => {
    setHistory((h) => {
      setNode(h[h.length - 1])
      return h.slice(0, -1)
    })
  }

  const n = tree[node]

  return (
    <>
      <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-base font-bold">{s.nm}</h3>
          <p className="mt-0.5 text-[13px] text-[#4A6461]">
            第 {history.length + 1} 題・依你的答案決定下一題
          </p>
        </div>
        <div className="px-4 py-4">
          <div className="mb-3 text-[16.5px] font-semibold leading-relaxed">{n.t}</div>
          <div className="grid gap-2">
            {n.o.map(([label, next], i) => (
              <button
                key={i}
                type="button"
                disabled={saving}
                onClick={() => choose(next)}
                className="rounded-xl border-[1.5px] border-[#C7E2DC] bg-white px-4 py-3.5 text-left text-[15px] leading-snug text-[#0E2E2B] disabled:opacity-60"
              >
                {label}
              </button>
            ))}
          </div>
          {history.length > 0 && (
            <button
              onClick={back}
              className="mt-3 text-[14px] font-medium text-[#12776E]"
            >
              ← 上一題
            </button>
          )}
        </div>
      </section>
      <BackLink onClick={onBack} />
    </>
  )
}
