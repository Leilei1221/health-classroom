import { useState } from 'react'
import Care from './care'
import {
  SCALES, choiceLabel, choiceSub, questionCount, questionSub, questionText,
  type Choice, type Question, type ScaleKey,
} from './scales'
import type { ScaleOutcome } from './state'
import { gradeAnswers } from './state'
import type { SelfcheckPatch } from '../api'

const LEVEL_DOT: Record<string, string> = {
  g: 'bg-[#2E8B62]', y: 'bg-[#D19A2E]', o: 'bg-[#B26A12]', r: 'bg-[#A8403C]',
}

/** 作答畫面；送出後由上層決定要不要顯示結果 */
export default function Scale({ scaleKey, onSubmit, onBack, saving }: {
  scaleKey: ScaleKey
  onSubmit: (patch: SelfcheckPatch, outcome: ScaleOutcome) => void
  onBack: () => void
  saving: boolean
}) {
  const s = SCALES[scaleKey]
  const total = questionCount(scaleKey) ?? 0
  // check 型是勾選，沒勾就是沒做到，一開始就算答完了
  const [ans, setAns] = useState<(number | null)[]>(
    () => new Array(total).fill(s.kind === 'check' ? 0 : null),
  )

  const left = s.kind === 'check' ? 0 : ans.filter((a) => a === null).length
  const pick = (i: number, v: number) =>
    setAns((prev) => prev.map((a, k) => (k === i ? v : a)))

  const send = () => {
    const { outcome, patch } = gradeAnswers(scaleKey, ans.map((a) => a ?? 0))
    onSubmit(patch, outcome)
  }

  return (
    <>
      <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-base font-bold">{s.nm}</h3>
          <p className="mt-0.5 text-[13px] text-[#4A6461]">{s.src}</p>
        </div>

        {s.lead && <p className="px-4 pb-1 pt-3 text-[14px] text-[#4A6461]">{s.lead}</p>}
        {s.note224 && (
          <p className="mx-3 mt-3 rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-3.5 py-3 text-[13px] text-[#4A6461]">
            {s.note224}
          </p>
        )}
        {s.ask && <p className="px-4 pb-1 pt-3 text-[15px] font-medium">{s.ask}</p>}

        {s.kind === 'check' ? (
          <div className="px-3 pb-3 pt-1">
            {(s.qs ?? []).map((q, i) => (
              <label key={i} className="flex items-start gap-3 border-b border-[#F0F6F5] px-1 py-3 last:border-0">
                <input
                  type="checkbox"
                  checked={ans[i] === 1}
                  onChange={(e) => pick(i, e.target.checked ? 1 : 0)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#12776E]"
                />
                <QuestionText q={q} />
              </label>
            ))}
          </div>
        ) : (
          <div className="px-3 pb-3 pt-1">
            {rows(scaleKey).map(({ q, opts, values, i }) => (
              <div key={i} className="border-b border-[#F0F6F5] px-1 py-3 last:border-0">
                <div className="mb-2.5 flex gap-1.5 text-[15px]">
                  <i className="not-italic tabular-nums text-[#4A6461]">{i + 1}.</i>
                  <QuestionText q={q} />
                </div>
                <div className={`grid gap-1.5 ${opts.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {opts.map((o, k) => {
                    const v = values[k]
                    const on = ans[i] === v
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => pick(i, v)}
                        className={`rounded-xl border-[1.5px] px-1.5 py-2.5 text-[13.5px] leading-tight ${
                          on
                            ? 'border-[#12776E] bg-[#12776E] font-bold text-white'
                            : 'border-[#C7E2DC] bg-white text-[#4A6461]'
                        }`}
                      >
                        {choiceLabel(o)}
                        {choiceSub(o) && (
                          <span className={`mt-0.5 block text-[11px] ${on ? 'text-white/80' : 'text-[#8CA5A2]'}`}>
                            {choiceSub(o)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <BackLink onClick={onBack} />

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] border-t border-[#C7E2DC] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        <div className="mb-2 text-[13px] text-[#4A6461]">
          {left ? `還有 ${left} 題沒作答` : '都答完了，可以送出'}
        </div>
        <button
          onClick={send}
          disabled={left > 0 || saving}
          className="w-full rounded-xl bg-[#12776E] py-4 text-[17px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#B8CFCC]"
        >
          {saving ? '送出中…' : '送出'}
        </button>
      </div>
    </>
  )
}

/**
 * 把 likert 的分組題目攤平成連續題號，其餘沿用自己的選項。
 *
 * values 是每個選項要記進 ans 的分數。light 與 likert 就是選項順序，
 * 但「是／否」題的是＝1、否＝0，順序與分數相反，不能拿索引當分數用。
 */
function rows(key: ScaleKey): { q: Question; opts: Choice[]; values: number[]; i: number }[] {
  const s = SCALES[key]
  const out: { q: Question; opts: Choice[]; values: number[]; i: number }[] = []
  const seq = (n: number) => Array.from({ length: n }, (_, i) => i)
  if (s.groups) {
    let i = 0
    for (const g of s.groups) {
      for (const q of g.qs) out.push({ q, opts: g.opts, values: seq(g.opts.length), i: i++ })
    }
    return out
  }
  if (s.kind === 'yn') {
    ;(s.qs ?? []).forEach((q, i) => out.push({ q, opts: ['是', '否'], values: [1, 0], i }))
    return out
  }
  const opts = s.opts ?? []
  ;(s.qs ?? []).forEach((q, i) => out.push({ q, opts, values: seq(opts.length), i }))
  return out
}

function QuestionText({ q }: { q: Question }) {
  return (
    <span className="flex-1">
      {questionText(q)}
      {questionSub(q) && (
        <span className="block text-[12.5px] text-[#4A6461]">{questionSub(q)}</span>
      )}
    </span>
  )
}

export function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mx-3 mb-4 block w-[calc(100%-24px)] rounded-xl border border-[#C7E2DC] bg-white py-3 text-[15px] font-medium text-[#12776E]"
    >
      ← 回到檢測清單
    </button>
  )
}

/**
 * 結果畫面。剛做完與回頭看上次結果共用同一段，
 * 差別只在下方多不多一顆「重新作答」。
 */
export function ScaleResult({ scaleKey, outcome, onBack, onRetake }: {
  scaleKey: ScaleKey
  outcome: ScaleOutcome
  onBack: () => void
  onRetake?: () => void
}) {
  const s = SCALES[scaleKey]
  const zoneArrays = outcome.zones
    ? [outcome.zones.green, outcome.zones.yellow, outcome.zones.red]
    : []
  const diet = outcome.dietType && s.results ? s.results[outcome.dietType] : null

  return (
    <>
      <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-base font-bold">{s.nm}・你的結果</h3>
          <p className="mt-0.5 text-[13px] text-[#4A6461]">這不是成績，是一張此刻的照片</p>
        </div>

        <div className="px-4 py-4">
          {s.kind === 'light' && s.zones ? (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {s.zones.map((z, i) => (
                  <div key={z.k} className="rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-2 py-3 text-center">
                    <b className="flex items-center justify-center gap-1.5 text-[13.5px]">
                      <span className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[z.k]}`} />
                      {z.nm}
                    </b>
                    <span className="my-0.5 block text-2xl font-bold tabular-nums">
                      {zoneArrays[i].length}
                    </span>
                    <small className="block text-[11.5px] leading-snug text-[#4A6461]">
                      {zoneArrays[i].length ? `第 ${zoneArrays[i].join('、')} 題` : '沒有題目'}
                    </small>
                  </div>
                ))}
              </div>
              {s.zones.map((z, i) =>
                zoneArrays[i].length ? (
                  <p key={z.k} className="mb-2 text-[14px] leading-relaxed text-[#4A6461]">
                    <b className="text-[#0E2E2B]">{z.sub}</b>　{z.msg}
                  </p>
                ) : null,
              )}
              <p className="text-[14px] leading-relaxed">
                下一步：從<b>黃燈區或紅燈區</b>挑一項你最想改的，我們下節課會把它寫成一份自主管理計畫。
              </p>
            </>
          ) : diet ? (
            <>
              <div className="text-[32px] font-bold leading-none">{outcome.dietType} 型</div>
              <h4 className="mb-1.5 mt-2.5 flex items-center gap-2 text-[15px] font-bold">
                <span className={`h-3 w-3 rounded-full ${LEVEL_DOT[diet.level]}`} />
                {diet.nm}
              </h4>
              <p className="mb-2 text-[14px] leading-relaxed text-[#4A6461]">{diet.msg}</p>
              <p className="text-[14px] leading-relaxed">
                <b>可以試試看</b>　{diet.tip}
              </p>
            </>
          ) : (
            <>
              <div className="text-[32px] font-bold leading-none tabular-nums">
                {outcome.score}
                <span className="ml-1 text-base font-normal">{s.kind === 'check' ? '項' : '分'}</span>
              </div>
              {outcome.band && (
                <h4 className="mb-1.5 mt-2.5 flex items-center gap-2 text-[15px] font-bold">
                  <span className={`h-3 w-3 rounded-full ${LEVEL_DOT[outcome.band.level]}`} />
                  {outcome.band.label}
                </h4>
              )}
              {outcome.band?.msg && (
                <p className="text-[14px] leading-relaxed text-[#4A6461]">{outcome.band.msg}</p>
              )}
              {s.tail && <p className="mt-2 text-[13px] text-[#4A6461]">{s.tail}</p>}
            </>
          )}
        </div>
      </section>

      {/*
        關懷文案與上面的分級文案中間留一道分隔線和空白。
        兩段文字都是固定內容、一個字都不改，但分數低、分級文案樂觀
        卻又要出現關懷文案時（第 20 題勾過就會這樣），
        擠在一起讀起來會互相打架，分開成兩張卡片就不會。
      */}
      {outcome.flag && (
        <>
          <div className="mx-6 mb-5 mt-7 border-t border-[#C7E2DC]" />
          <Care critical={outcome.critical} />
        </>
      )}

      <div className="mx-3 rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[13px] leading-relaxed text-[#4A6461]">
        這份結果只有你和健護老師看得到，不會給其他老師或同學，也不會算進任何成績。
      </div>

      {onRetake && (
        <button
          onClick={onRetake}
          className="mx-3 mt-3.5 block w-[calc(100%-24px)] rounded-xl border-[1.5px] border-[#12776E] bg-white py-3 text-[15px] font-bold text-[#12776E]"
        >
          重新作答
        </button>
      )}
      <div className="mt-3.5">
        <BackLink onClick={onBack} />
      </div>
    </>
  )
}
