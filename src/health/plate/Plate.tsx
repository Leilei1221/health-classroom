import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import HealthHeader, { PreviewBanner } from '../Header'
import { getSelfcheck, saveSelfcheck, semesterKey } from '../api'
import {
  CAT, CAT_KEYS, DEFAULT_KCAL, GOALS, GROUPS, KCAL_CHOICES, SCALE, WATER_GOAL,
} from './foods'
import {
  fmt, foodAt, foodKcal, judge, judgeInput, macros, summary, totalKcal, totals,
  type PickedItem, type Totals,
} from './judge'
import type { PlateResult, StudentProfile } from '../../lib/types'

/** preview 有值時為教師預覽：套用假學生、不讀也不寫資料庫 */
export default function Plate({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [kcalTarget, setKcalTarget] = useState(DEFAULT_KCAL)
  const [log, setLog] = useState<PickedItem[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<number>>(() =>
    new Set(GROUPS.map((g, i) => (g.open ? i : -1)).filter((i) => i >= 0)))
  const [toast, setToast] = useState<{ title: string; lines: string[] } | null>(null)
  const [sent, setSent] = useState<PlateResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!student) return
    if (isPreview) { setLoading(false); return }
    getSelfcheck(student.email, semester)
      .then((row) => {
        if (!row?.plate) return
        setSent(row.plate)
        setKcalTarget(row.plate.kcalTarget || DEFAULT_KCAL)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [student, semester, isPreview])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const t = useMemo(() => totals(log), [log])
  const m = useMemo(() => macros(t), [t])
  const goals = GOALS[kcalTarget]
  const kcal = Math.round(totalKcal(t))

  const showBreakdown = (gi: number, ii: number) => {
    const { e, n, parts, ex } = foodAt(gi, ii)
    const bits = CAT_KEYS.filter((k) => parts[k])
      .map((k) => `${CAT[k].nm} ${fmt(parts[k]!)} ${CAT[k].unit}`)
    const lines = [bits.length ? bits.join('　＋　') : '不含六大類食物']
    if (ex?.sugar) lines.push(`含糖飲料 ${ex.sugar} c.c.，不能算進喝水量`)
    if (ex?.water) lines.push(`喝水 +${ex.water} c.c.`)
    setToast({ title: `${e} ${n} ＝`, lines })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }

  const add = (gi: number, ii: number) => {
    setLog((prev) => {
      const hit = prev.find((x) => x.gi === gi && x.ii === ii)
      return hit
        ? prev.map((x) => (x === hit ? { ...x, n: x.n + 1 } : x))
        : [...prev, { gi, ii, n: 1 }]
    })
    showBreakdown(gi, ii)
  }

  const removeAt = (i: number) =>
    setLog((prev) => prev.flatMap((e, k) => (k !== i ? [e] : e.n > 1 ? [{ ...e, n: e.n - 1 }] : [])))

  const countOf = (gi: number, ii: number) => log.find((x) => x.gi === gi && x.ii === ii)?.n ?? 0

  const send = async () => {
    const r = judge(log, kcalTarget)
    // 份數是 0.5 的倍數相加，浮點誤差會留下 11.129999999 這種尾巴，存進去前先收乾淨
    const round2 = (n: number) => Math.round(n * 100) / 100
    const result: PlateResult = {
      grain: round2(t.grain), prot: round2(t.prot), milk: round2(t.milk),
      veg: round2(t.veg), fruit: round2(t.fruit), fat: round2(t.fat),
      water: t.water, sugar: t.sugar,
      kcalTarget, kcal,
      matched: r.matched, total: r.total,
      items: log.map((e) => ({ name: foodAt(e.gi, e.ii).n, n: e.n })),
    }
    if (isPreview) { setSent(result); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    if (!student) return
    setSaving(true); setError('')
    try {
      // 餐盤是課堂活動，不影響 needs_followup
      await saveSelfcheck(student.email, semester, { plate: result })
      setSent(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  if (!student) return null
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>

  const filled = CAT_KEYS.filter((k) => t[k] > 0).length
  const q = query.trim()

  return (
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-32">
        <HealthHeader student={student} isPreview={isPreview} tab="plate" />

        {/* 置頂儀表：六條份量尺 */}
        <div className="sticky top-0 z-20 border-b border-white/15 bg-[#0B4A44] px-3.5 pb-3 pt-1 text-white">
          {CAT_KEYS.map((k) => {
            const cur = t[k]
            const goal = goals[k]
            const pctGoal = (goal / SCALE) * 100
            const pctCur = (Math.min(cur, SCALE) / SCALE) * 100
            const inGoal = (Math.min(cur, goal) / SCALE) * 100
            return (
              <div key={k} className="mb-[5px] flex items-center gap-[7px]">
                <span className="flex w-[60px] shrink-0 items-center gap-[5px] whitespace-nowrap text-[11px] tracking-tight text-[#CFE7E3]">
                  <i className="h-[9px] w-[9px] shrink-0 rounded-sm" style={{ background: CAT[k].col }} />
                  {CAT[k].sh}
                </span>
                <span className="relative h-[17px] flex-1 rounded bg-white/10">
                  <span
                    className="absolute inset-y-0 left-0 rounded-l transition-[width] duration-300"
                    style={{ width: `${inGoal}%`, background: CAT[k].col }}
                  />
                  {cur > goal && (
                    <span
                      className="absolute inset-y-0 rounded-r transition-all duration-300"
                      style={{
                        left: `${pctGoal}%`,
                        width: `${Math.max(0, pctCur - pctGoal)}%`,
                        backgroundImage: 'repeating-linear-gradient(45deg,#E8B54A 0 4px,#B2851F 4px 8px)',
                      }}
                    />
                  )}
                  <span className="absolute -top-[3px] bottom-[-3px] w-0.5 rounded-sm bg-white" style={{ left: `${pctGoal}%` }} />
                </span>
                <span className={`w-[50px] shrink-0 text-right text-[11.5px] tabular-nums ${
                  cur > goal ? 'font-bold text-[#F0C24A]' : cur === goal ? 'font-bold text-[#8FE0B4]' : 'text-white'
                }`}>
                  {fmt(cur)}/{fmt(goal)}
                </span>
              </div>
            )
          })}
          <div className="mb-[5px] flex items-center gap-[7px]">
            <span className="flex w-[60px] shrink-0 items-center gap-[5px] whitespace-nowrap text-[11px] text-[#CFE7E3]">
              <i className="h-[9px] w-[9px] shrink-0 rounded-sm bg-[#4FA8C7]" />喝水
            </span>
            <span className="relative h-[17px] flex-1 rounded bg-white/10">
              <span
                className="absolute inset-y-0 left-0 rounded bg-[#4FA8C7] transition-[width] duration-300"
                style={{ width: `${(Math.min(t.water, WATER_GOAL) / WATER_GOAL) * 100}%` }}
              />
              <span className="absolute -top-[3px] bottom-[-3px] left-full w-0.5 rounded-sm bg-white" />
            </span>
            <span className={`w-[50px] shrink-0 text-right text-[11.5px] tabular-nums ${
              t.water >= WATER_GOAL ? 'font-bold text-[#8FE0B4]' : 'text-white'
            }`}>
              {t.water}cc
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-white/15 pt-2 text-[11.5px] text-[#BFDDD9]">
            <span className="whitespace-nowrap">
              今日熱量<b className="text-[15px] font-bold tabular-nums text-white">{kcal}</b>／{kcalTarget} 大卡
            </span>
            <span className="flex h-[13px] flex-1 overflow-hidden rounded-sm bg-white/10" title="醣類／蛋白質／脂質 的熱量佔比">
              <span className="bg-[#D9A441] transition-[width] duration-300" style={{ width: `${m.pc}%` }} />
              <span className="bg-[#C56B78] transition-[width] duration-300" style={{ width: `${m.pp}%` }} />
              <span className="bg-[#8A6FA8] transition-[width] duration-300" style={{ width: `${m.pf}%` }} />
            </span>
            <span className="w-[92px] shrink-0 text-right tabular-nums">
              {m.tot ? `${Math.round(m.pc)}／${Math.round(m.pp)}／${Math.round(m.pf)}` : '醣／蛋／脂'}
            </span>
          </div>
        </div>

        {isPreview && (
          <PreviewBanner>這是學生在手機上看到的畫面。可以試點食物，但送出不會寫入任何資料。</PreviewBanner>
        )}
        {error && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">{error}</div>
        )}

        {sent ? (
          <Result sent={sent} onAgain={() => setSent(null)} />
        ) : (
          <>
            <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
              <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
                <h3 className="text-[15.5px] font-bold">先選你一天需要的熱量</h3>
                <p className="mt-0.5 text-[12.5px] text-[#4A6461]">
                  不知道就先用預設值，之後可由登記頁的體重與活動量自動帶入
                </p>
              </div>
              <div className="grid grid-cols-5 gap-1.5 px-4 py-3">
                {KCAL_CHOICES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={k === kcalTarget}
                    onClick={() => setKcalTarget(k)}
                    className={`rounded-[10px] border-[1.5px] px-0.5 py-2.5 text-[13.5px] tabular-nums ${
                      k === kcalTarget
                        ? 'border-[#12776E] bg-[#12776E] font-bold text-white'
                        : 'border-[#C7E2DC] bg-white text-[#4A6461]'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <p className="px-4 pb-3 text-[12.5px] text-[#4A6461]">
                熱量不同，六大類可以吃的份數就不同——這就是為什麼沒有一體適用的餐盤。
              </p>
            </section>

            <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
              <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
                <h3 className="text-[15.5px] font-bold">今天吃了什麼</h3>
                <p className="mt-0.5 text-[12.5px] text-[#4A6461]">點一下加一份，點下面的清單可以拿掉</p>
              </div>
              <div className="px-3.5 pb-0.5 pt-2.5">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋食物… 例如「雞」「拿鐵」「盤」"
                  className="w-full rounded-[10px] border-[1.5px] border-[#C7E2DC] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#12776E] focus:ring-1 focus:ring-[#12776E]"
                />
              </div>

              {GROUPS.map((g, gi) => {
                const items = g.items
                  .map((f, ii) => ({ f, ii }))
                  .filter(({ f }) => !q || `${f.n} ${g.nm}`.includes(q))
                if (!items.length) return null
                const expanded = q ? true : open.has(gi)
                return (
                  <div key={g.nm} className="border-b border-[#F0F6F5] last:border-0">
                    <button
                      onClick={() => setOpen((prev) => {
                        const next = new Set(prev)
                        if (next.has(gi)) next.delete(gi); else next.add(gi)
                        return next
                      })}
                      className="flex w-full items-baseline gap-1.5 px-3.5 py-3 text-left text-[14.5px] font-bold"
                    >
                      <span className={`text-xs text-[#12776E] transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
                      {g.nm}
                      <span className="ml-auto text-right text-[11.5px] font-normal text-[#4A6461]">{g.note}</span>
                    </button>
                    {expanded && (
                      <>
                        <div className="grid grid-cols-3 gap-[7px] px-3 pb-3">
                          {items.map(({ f, ii }) => {
                            const n = countOf(gi, ii)
                            const kc = f.ex?.kc ?? foodKcal(f.parts)
                            return (
                              <button
                                key={f.n + ii}
                                onClick={() => add(gi, ii)}
                                className={`relative rounded-[11px] border-[1.5px] px-1 pb-1.5 pt-2 text-center leading-tight active:scale-95 ${
                                  n === 0
                                    ? `border-[#C7E2DC] bg-white ${g.warn ? 'border-dashed' : ''}`
                                    : g.warn
                                      ? 'border-[#8B8177] bg-[#F6F4F2]'
                                      : 'border-[#12776E] bg-[#F0F8F7]'
                                }`}
                              >
                                {n > 0 && (
                                  <span className={`absolute -right-1.5 -top-[7px] flex h-[21px] min-w-[21px] items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${
                                    g.warn ? 'bg-[#8B8177]' : 'bg-[#12776E]'
                                  }`}>
                                    {n}
                                  </span>
                                )}
                                <span className="mb-0.5 block text-2xl">{f.e}</span>
                                <span className="block text-[13px] font-semibold">{f.n}</span>
                                <span className="block text-[11px] text-[#4A6461]">{f.p}</span>
                                {!f.p.includes('大卡') && (
                                  <span className="mt-px block text-[10.5px] tabular-nums text-[#9AAFAC]">{kc} 大卡</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        {g.src && (
                          <p className="px-3.5 pb-3 text-[11.5px] leading-relaxed text-[#8CA5A2]">{g.src}</p>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </section>

            <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
              <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
                <h3 className="text-[15.5px] font-bold">我吃掉的</h3>
                <p className="mt-0.5 text-[12.5px] text-[#4A6461]">點任一項可以移除</p>
              </div>
              {log.length ? (
                <div className="flex flex-wrap gap-1.5 px-3.5 py-2.5">
                  {log.map((e, i) => {
                    const f = foodAt(e.gi, e.ii)
                    return (
                      <button
                        key={`${e.gi}-${e.ii}`}
                        onClick={() => removeAt(i)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#C7E2DC] bg-[#F0F8F7] px-2.5 py-1.5 text-[13px]"
                      >
                        {f.e} {f.n}
                        {e.n > 1 && <b className="text-[11.5px] font-normal text-[#4A6461]">×{e.n}</b>}
                        <span className="text-[#4A6461]">✕</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="px-4 py-3.5 text-[13px] text-[#4A6461]">還沒點任何東西。</p>
              )}
            </section>

            <p className="mx-3 px-1 pb-2 text-[11.5px] leading-relaxed text-[#4A6461]">
              份數與熱量依「衛生福利部國民健康署－每日飲食指南／食物代換表」；六大類口訣與 85210
              依育達乙版全一冊Ⅰ 第一章。連鎖店熱量為各品牌公布值（全家取自官方「食在購安心」平台；查核日
              2026-09-11）；所有<b>份數</b>皆為依成分的教學換算，非官方數據。菜單會改版，每學期複查一次。
            </p>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-36px)] max-w-[440px] -translate-x-1/2 rounded-xl bg-[#0B4A44]/95 px-4 py-2.5 text-[13.5px] text-white">
          <b className="mb-0.5 block text-[14.5px]">{toast.title}</b>
          {toast.lines.map((l, i) => (
            <span key={i} className={`block ${i > 0 ? 'text-[#F0C24A]' : ''}`}>{l}</span>
          ))}
        </div>
      )}

      {!sent && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] border-t border-[#C7E2DC] bg-white/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
          <div className="mb-1.5 text-[12.5px] text-[#4A6461]">
            {filled === 0 ? '六個格子都還是空的'
              : filled < 6 ? `還有 ${6 - filled} 類是空的`
              : '六類都有東西了，看看結果'}
          </div>
          <button
            onClick={() => void send()}
            disabled={log.length === 0 || saving}
            className="w-full rounded-[11px] bg-[#12776E] py-3.5 text-[17px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#B8CFCC]"
          >
            {saving ? '送出中…' : '看我的一日餐盤'}
          </button>
        </div>
      )}
    </div>
  )
}

function Result({ sent, onAgain }: { sent: PlateResult; onAgain: () => void }) {
  // 結果卡片由存下來的份量重算，重新整理後回來看也會是同一份
  const r = rebuild(sent)
  const s = summary(r)

  return (
    <>
      <section className="mx-3 my-3 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-[15.5px] font-bold">六大類：裝滿了嗎</h3>
          <p className="mt-0.5 text-[12.5px] text-[#4A6461]">不是分數，是看哪一格空著、哪一格滿出來</p>
        </div>
        {r.out.map((c) => (
          <div key={c.t} className="flex items-start gap-3 border-b border-[#C7E2DC] px-4 py-3.5 last:border-0">
            <span className={`mt-0.5 flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold text-white ${
              c.ok ? 'bg-[#2E8B62]' : 'bg-[#D19A2E]'
            }`}>
              {c.ok ? '✓' : '!'}
            </span>
            <div>
              <h4 className="mb-0.5 text-[14.5px] font-bold">{c.t}</h4>
              <p className="text-[13.5px] leading-relaxed text-[#4A6461]">{c.p}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mx-3 my-3 rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-4 py-4">
        <strong className="mb-1.5 block text-[15px] text-[#0B4A44]">{s.head}</strong>
        <p className="text-[13.5px] leading-relaxed text-[#4A6461]">{s.body}</p>
        {r.over.length > 0 && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-[#4A6461]">
            <strong className="text-[#B26A12]">滿出來的份量：</strong>{r.over.join('、')}。
          </p>
        )}
        {r.notes.map((n, i) => (
          <p key={i} className="mt-3 text-[13.5px] leading-relaxed text-[#4A6461]">{n}</p>
        ))}
      </div>

      {sent.items.length > 0 && (
        <div className="mx-3 my-3 rounded-xl border border-[#C7E2DC] bg-white px-4 py-3.5">
          <h4 className="mb-1.5 text-[14px] font-bold">你點的</h4>
          <p className="text-[13px] leading-relaxed text-[#4A6461]">
            {sent.items.map((i) => i.n > 1 ? `${i.name} ×${i.n}` : i.name).join('、')}
          </p>
        </div>
      )}

      <div className="mx-3 rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#4A6461]">
        份數是「代換」的概念，不是精確的秤重。同一類裡的食物可以互換，
        所以重點不是你吃了什麼牌子，而是每一類裝了多少。
        <button
          onClick={onAgain}
          className="mt-3 block w-full rounded-[11px] border-[1.5px] border-[#12776E] bg-white py-3 text-[15.5px] font-bold text-[#12776E]"
        >
          重新來一次
        </button>
      </div>
    </>
  )
}

/**
 * 由存下來的結果重建判定，讓學生重新整理或下次進來還看得到同一份。
 *
 * 份量、喝水、含糖量與總熱量都直接用存下來的值，不重算，
 * 這樣即使日後食物庫改版，舊紀錄看到的仍然是他當時送出的那一份。
 * 只有「有沒有吃到全穀／深色蔬菜／加工肉」要回頭查食物庫，
 * 靠品名比對；品名改過或被刪掉時，那幾條附註就不出現。
 */
function rebuild(p: PlateResult) {
  const t = {
    grain: p.grain, prot: p.prot, milk: p.milk, veg: p.veg, fruit: p.fruit, fat: p.fat,
    water: p.water, sugar: p.sugar, kcalAdj: 0,
  } as Totals
  const eaten = p.items.map((i) => lookup(i.name)).filter((f) => f !== undefined)
  return judgeInput({
    t,
    kcal: p.kcal,
    kcalTarget: p.kcalTarget,
    whole: eaten.some((f) => !!f!.ex?.whole),
    dark: eaten.some((f) => !!f!.ex?.dark),
    proc: eaten.some((f) => !!f!.ex?.proc),
  })
}

function lookup(name: string) {
  for (const g of GROUPS) {
    const hit = g.items.find((f) => f.n === name)
    if (hit) return hit
  }
  return undefined
}
