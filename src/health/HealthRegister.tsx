import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import { friendlyError } from '../lib/errors'
import { getMeasurement, saveMeasurement, semesterKey } from './api'
import { ALL_FIELDS, REQUIRED, SECTIONS, type Field } from './fields'
import { calcBmi, calcFatKg, calcWhr, judgeBmi, judgeBp, judgeWhr, type Verdict } from './rules'
import type { HealthMeasurement, MeasurementRound } from '../lib/types'

/** 第一版只做期初；期中／期末沿用同一頁，改這個常數即可 */
const ROUND: MeasurementRound = 'initial'

type Values = Record<string, string>

const DOT: Record<Verdict['level'], string> = {
  g: 'bg-emerald-600', y: 'bg-amber-500', o: 'bg-amber-700',
}

function outOfRange(f: Field, raw: string): boolean {
  if (f.min === undefined || raw.trim() === '') return false
  const v = Number(raw)
  return Number.isNaN(v) || v < f.min || v > (f.max ?? Infinity)
}

export default function HealthRegister() {
  const { student, signOut } = useAuth()
  const [values, setValues] = useState<Values>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 讀不到先前紀錄不影響填寫與送出，因此與送出失敗分開處理，
  // 不要讓學生一進頁就看到紅色錯誤
  const [loadWarning, setLoadWarning] = useState('')
  const [saved, setSaved] = useState<HealthMeasurement | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const semester = student ? semesterKey(student) : ''

  useEffect(() => {
    if (!student) return
    getMeasurement(student.email, semester, ROUND)
      .then((row) => {
        if (!row) return
        const next: Values = {}
        ALL_FIELDS.forEach((f) => {
          const v = (row as unknown as Record<string, unknown>)[f.key]
          if (v !== null && v !== undefined) next[f.key] = String(v)
        })
        setValues(next)
      })
      .catch(() => setLoadWarning('沒有讀到你先前的紀錄，直接填寫即可。'))
      .finally(() => setLoading(false))
  }, [student, semester])

  const num = (k: string) => Number(values[k])
  const has = (k: string) => values[k] !== undefined && values[k].trim() !== ''

  const bmi = has('height_cm') && has('weight_kg') ? calcBmi(num('height_cm'), num('weight_kg')) : null
  const fat = has('weight_kg') && has('body_fat_pct') ? calcFatKg(num('weight_kg'), num('body_fat_pct')) : null
  const whr = has('waist_cm') && has('hip_cm') ? calcWhr(num('waist_cm'), num('hip_cm')) : null

  const missing = useMemo(() => REQUIRED.filter((k) => !has(k)), [values])
  const suspicious = useMemo(
    () => ALL_FIELDS.filter((f) => outOfRange(f, values[f.key] ?? '')),
    [values],
  )

  // 規格書：超出範圍不擋死，提示後學生確認仍可送出；少填則不能送出
  const canSubmit = missing.length === 0 && (suspicious.length === 0 || confirmed)

  const set = (k: string, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }))
    setConfirmed(false)
  }

  const submit = async () => {
    if (!student) return
    setSaving(true); setError(''); setLoadWarning('')
    try {
      const row: Record<string, unknown> = {
        student_email: student.email, semester, round: ROUND,
      }
      ALL_FIELDS.forEach((f) => {
        const raw = values[f.key]
        if (raw === undefined || raw.trim() === '') { row[f.key] = null; return }
        row[f.key] = f.key === 'machine_no' ? raw.trim() : Number(raw)
      })
      setSaved(await saveMeasurement(row as never))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  if (!student) return null
  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>
  }

  return (
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-32">
        <header className="bg-[#0B4A44] px-5 pb-4 pt-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xl font-bold tracking-wide">{student.name}</div>
              <div className="mt-0.5 text-[13px] opacity-70">
                {student.class_name} 班・座號 {student.seat_no ?? '—'}・
                {student.academic_year} 學年度第 {student.semester} 學期
              </div>
            </div>
            <button onClick={signOut} className="shrink-0 text-[13px] opacity-70 hover:opacity-100">
              登出
            </button>
          </div>
        </header>

        {/* 自動計算讀數（sticky） */}
        <div className="sticky top-0 z-20 border-b border-white/15 bg-[#0B4A44] px-5 pb-4 pt-3 text-white">
          <h2 className="mb-2.5 text-xs font-medium tracking-widest text-[#8FC9C1]">自動計算</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              ['BMI', bmi, 1],
              ['體脂重量 kg', fat, 1],
              ['腰臀比', whr, 2],
            ].map(([k, v, dp]) => (
              <div key={k as string} className="border-l-2 border-[#8FC9C1]/40 pl-2.5">
                <span className="block text-xs text-[#9CCFC8]">{k as string}</span>
                <span className={`block leading-tight tabular-nums ${
                  v === null ? 'text-[22px] font-normal text-[#4E7F79]' : 'text-[26px] font-bold'
                }`}>
                  {v === null ? '—' : (v as number).toFixed(dp as number)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {loadWarning && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FDF3E3] px-4 py-3 text-sm text-[#8A5310]">
            {loadWarning}
          </div>
        )}

        {error && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">
            {error}
          </div>
        )}

        {saved ? (
          <Result bmi={bmi} whr={whr} sbp={num('sbp')} dbp={num('dbp')} onEdit={() => setSaved(null)} />
        ) : (
          <>
            {SECTIONS.map((sec) => (
              <section key={sec.title} className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
                <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
                  <h3 className="text-base font-bold">{sec.title}</h3>
                  <p className="mt-0.5 text-[13px] text-[#4A6461]">{sec.hint}</p>
                </div>
                <div className="px-4 pb-3.5 pt-1.5">
                  {sec.fields.map((f) => {
                    const bad = outOfRange(f, values[f.key] ?? '')
                    return (
                      <div key={f.key}>
                        <div className="flex items-center gap-3 border-b border-[#F0F6F5] py-2.5 last:border-0">
                          <label className="flex-1 text-[15px]" htmlFor={f.key}>
                            {f.label}
                            {f.sub && <span className="block text-xs text-[#4A6461]">{f.sub}</span>}
                          </label>
                          <input
                            id={f.key}
                            inputMode={f.decimal ? 'decimal' : 'numeric'}
                            value={values[f.key] ?? ''}
                            onChange={(e) => set(f.key, e.target.value)}
                            placeholder="—"
                            className={`w-[110px] rounded-lg border-[1.5px] px-2.5 py-2 text-right text-[19px] font-semibold tabular-nums outline-none focus:border-[#12776E] focus:ring-1 focus:ring-[#12776E] ${
                              bad ? 'border-[#A8403C] bg-[#FBEDEC]' : 'border-[#C7E2DC] bg-white'
                            }`}
                          />
                          <span className="w-9 text-[13px] text-[#4A6461]">{f.unit}</span>
                        </div>
                        {bad && (
                          <div className="mb-2.5 rounded-lg bg-[#FBEDEC] px-3 py-2 text-[13px] text-[#A8403C]">
                            這個數字看起來不太對（合理範圍 {f.min}～{f.max}），請再確認一次機器上的讀數。
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}

            {suspicious.length > 0 && missing.length === 0 && (
              <div className="mx-3 mb-3 rounded-xl border border-[#E2C9A6] bg-[#FDF3E3] p-4 text-sm text-[#8A5310]">
                <p className="mb-2">
                  有 {suspicious.length} 個數字超出常見範圍：
                  {suspicious.map((f) => f.label).join('、')}。
                </p>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#B26A12]"
                  />
                  <span>我已經再看過機器，這些數字沒有抄錯</span>
                </label>
              </div>
            )}
          </>
        )}
      </div>

      {!saved && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] border-t border-[#C7E2DC] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
          <div className="mb-2 text-[13px] text-[#4A6461]">
            {missing.length > 0
              ? `還有 ${missing.length} 個欄位要填`
              : suspicious.length > 0 && !confirmed
                ? '有數字要再確認一次'
                : '都填好了，可以送出'}
          </div>
          <button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="w-full rounded-xl bg-[#12776E] py-4 text-[17px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#B8CFCC]"
          >
            {saving ? '送出中…' : '送出登記'}
          </button>
        </div>
      )}
    </div>
  )
}

function Result({ bmi, whr, sbp, dbp, onEdit }: {
  bmi: number | null; whr: number | null; sbp: number; dbp: number; onEdit: () => void
}) {
  const items: [string, string, Verdict][] = []
  if (bmi !== null) items.push(['BMI', bmi.toFixed(1), judgeBmi(bmi)])
  if (!Number.isNaN(sbp) && !Number.isNaN(dbp)) {
    items.push(['血壓', `${sbp} / ${dbp}`, judgeBp(sbp, dbp)])
  }
  if (whr !== null) items.push(['腰臀比', whr.toFixed(2), judgeWhr(whr)])

  return (
    <>
      <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
        <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
          <h3 className="text-base font-bold">今天的紀錄</h3>
          <p className="mt-0.5 text-[13px] text-[#4A6461]">
            這些數字是這學期的起點，之後會拿來跟自己比較
          </p>
        </div>
        {items.map(([name, value, v]) => (
          <div key={name} className="flex items-start gap-3.5 border-b border-[#C7E2DC] px-4 py-4 last:border-0">
            <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${DOT[v.level]}`} />
            <div>
              <h4 className="text-[15px]">{name}</h4>
              <div className="my-0.5 text-2xl font-bold tabular-nums">{value}</div>
              <p className="text-sm text-[#4A6461]">
                <strong>{v.label}</strong>　{v.msg}
              </p>
            </div>
          </div>
        ))}
      </section>
      <div className="mx-3 rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[13px] text-[#4A6461]">
        這裡看到的是參考範圍，不是診斷。數值只是提供你認識自己身體的線索，
        接下來的課會一起討論可以怎麼調整。
      </div>
      <div className="mx-3 mt-4">
        <button onClick={onEdit} className="w-full rounded-xl border border-[#C7E2DC] bg-white py-3 text-[15px] font-medium text-[#12776E]">
          修改我填的數值
        </button>
      </div>
    </>
  )
}
