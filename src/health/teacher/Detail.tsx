import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth'
import { listClasses } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import { ROUNDS, listClassDetail, type DetailStudent } from '../api'
import { SECTIONS, type Field } from '../fields'
import { SCALES } from '../selfcheck/scales'
import { outcomeFromRow } from '../selfcheck/state'
import { CAT, CAT_KEYS } from '../plate/foods'
import { H85210_KEYS, H85210_SHORT } from './labels'
import { buildClassCsv, computed, downloadCsv } from './csv'
import { hasRed, markList, marksOf, type Mark, type MarkKey, type Marks } from './thresholds'
import type { ClassRow, HealthMeasurement, MeasurementRound } from '../../lib/types'

/**
 * 教師端明細檢視（唯讀）。
 *
 * 補的是第一版漏掉的那一塊：老師看得到「登記了沒」，看不到「填了什麼」。
 *
 * 這一頁有分數，**不能投影**。班級進度表 /health/progress 才是投影用的那一頁，
 * 那一頁連查都不查分數。兩頁刻意分開，不要把明細掛到進度表的格子上——
 * 規格書寫「點學生格子跳出明細」是沿用原型的單一頁設計，但原型沒有
 * 「進度表要投到布幕上」這個前提。
 *
 * 唯讀：整頁沒有任何寫入資料庫的動作，也沒有任何編輯按鈕。
 * 學生要改資料一律自己回登記頁重送（upsert 會更新同一筆）。
 */
export default function Detail() {
  const { student, teacher } = useAuth()
  // 從班級進度按過來時會帶 ?class=，直接停在同一個班，不用再選一次
  const [params] = useSearchParams()
  const wantClass = params.get('class')
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [classId, setClassId] = useState<string | null>(wantClass)
  const [q, setQ] = useState('')
  const [round, setRound] = useState<MeasurementRound>('initial')
  const [rows, setRows] = useState<DetailStudent[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listClasses()
      .then((cs) => { if (!cancelled) setClasses(cs) })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [])

  /*
    決定停在哪一個班。跟著網址跑而不是只在第一次掛載時看一眼——
    已經停在這一頁時再按一次帶 ?class= 的連結，只會換 hash 不會重新掛載，
    只看初始值的話畫面會不動，看起來像連結壞掉。
    網址沒帶、或帶了一個對不到的班，就退回目前選的班或第一個班。
  */
  useEffect(() => {
    const active = (classes ?? []).filter((c) => c.is_active)
    if (active.length === 0) return
    const ok = (id: string | null) => !!id && active.some((c) => c.id === id)
    setClassId((prev) => (ok(wantClass) ? wantClass : ok(prev) ? prev : active[0].id))
  }, [classes, wantClass])

  const active = useMemo(() => (classes ?? []).filter((c) => c.is_active), [classes])
  const cls = active.find((c) => c.id === classId) ?? null

  useEffect(() => {
    if (!cls) return
    let cancelled = false
    setRows(null)
    setOpenId(null)
    setQ('')
    listClassDetail(cls.id, `${cls.academic_year}-${cls.semester}`)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [cls?.id, cls?.academic_year, cls?.semester])

  /** 座號、姓名、學號都能搜；座號打 7 就找得到 7 號，不用管有沒有補零 */
  const shown = useMemo(() => {
    const key = q.trim()
    if (!key || !rows) return rows
    const lower = key.toLowerCase()
    return rows.filter((r) =>
      r.name.includes(key)
      || String(r.seat_no ?? '') === key
      || r.student_no.toLowerCase().includes(lower))
  }, [rows, q])

  const open = (rows ?? []).find((r) => r.student_id === openId) ?? null
  const counts = useMemo(() => {
    const out = {} as Record<MeasurementRound, number>
    for (const r of ROUNDS) out[r.key] = (rows ?? []).filter((s) => s.rounds[r.key]).length
    return out
  }, [rows])

  if (error) return <Shell><Box tone="error">{error}</Box></Shell>
  if (classes === null) return <Shell><Box>載入中…</Box></Shell>

  // 擋人條件與另外兩頁一致：看有沒有帶班級，與 RLS 同一套
  if (active.length === 0) {
    return (
      <Shell>
        <Box tone="error">
          <strong className="mb-1 block">這一頁是健護老師用的</strong>
          {student ? (
            <>
              你的帳號在學生名單上（{student.class_name} 班・座號 {student.seat_no ?? '—'}）。
              要填自己的資料請到 <Link to="/health" className="font-medium underline">健康登記頁</Link>。
            </>
          ) : (
            <>這個帳號沒有帶任何班級，看不到學生資料。</>
          )}
        </Box>
      </Shell>
    )
  }

  return (
    <Shell subtitle={teacher?.display_name}>
      <div className="mb-3 rounded-xl border border-[#E7C4C2] bg-[#FBEDEC] px-4 py-2.5 text-[13px] leading-relaxed text-[#A8403C]">
        這一頁看得到分數和填答內容，<strong>請不要投影</strong>。
        上課要放的是 <Link to="/health/progress" className="underline">班級進度</Link>，那一頁只有「做了／沒做」。
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {active.map((c) => (
          <button
            key={c.id}
            onClick={() => setClassId(c.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              c.id === classId
                ? 'bg-slate-900 font-bold text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {ROUNDS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRound(r.key)}
              className={`px-3 py-1.5 text-sm ${
                r.key === round ? 'bg-slate-700 font-bold text-white' : 'bg-white text-slate-600'
              }`}
            >
              {r.label}
              <span className="ml-1 text-xs tabular-nums opacity-70">{counts[r.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <button
          disabled={!rows || rows.length === 0 || !cls}
          onClick={() => {
            if (!rows || !cls) return
            const label = ROUNDS.find((r) => r.key === round)!.label
            downloadCsv(
              `健康數值_${cls.name}_${cls.academic_year}-${cls.semester}_${label}.csv`,
              buildClassCsv(cls.name, rows, round),
            )
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          匯出 CSV
        </button>
        <span className="text-xs text-slate-500">
          匯出目前這個班、這一次測量的所有欄位
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="找學生：座號、姓名或學號"
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400"
        />
        {q && (
          <button onClick={() => setQ('')} className="text-sm text-slate-500 hover:text-slate-900">
            清除
          </button>
        )}
        {rows && (
          <span className="text-xs tabular-nums text-slate-500">
            {shown?.length ?? 0} / {rows.length} 人
          </span>
        )}
      </div>

      {rows === null ? (
        <Box>載入中…</Box>
      ) : rows.length === 0 ? (
        <Box>這個班的名單是空的。</Box>
      ) : shown!.length === 0 ? (
        <Box>這個班沒有符合「{q}」的學生。</Box>
      ) : (
        <Roster rows={shown!} round={round} onOpen={setOpenId} />
      )}

      {open && cls && (
        <Sheet
          student={open}
          className={cls.name}
          round={round}
          onRound={setRound}
          onClose={() => setOpenId(null)}
        />
      )}
    </Shell>
  )
}

/* ------------------------------------------------------------------ 名單 */

function Roster({ rows, round, onOpen }: {
  rows: DetailStudent[]; round: MeasurementRound; onOpen: (id: string) => void
}) {
  const line = (s: DetailStudent) => {
    const m = s.rounds[round]
    const marks = marksOf(m)
    const scales = SCALE_KEYS.filter((k) => outcomeFromRow(s.selfcheck, k)).length
    return { m, marks, scales }
  }

  return (
    <>
      {/* 手機：一人一張卡 */}
      <div className="space-y-2 sm:hidden">
        {rows.map((s) => {
          const { m, marks, scales } = line(s)
          return (
            <button
              key={s.student_id}
              onClick={() => onOpen(s.student_id)}
              className={`w-full rounded-xl border px-3.5 py-3 text-left ${
                hasRed(marks) ? 'border-[#E7C4C2] bg-[#FBEDEC]' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm tabular-nums text-slate-500">{s.seat_no ?? '—'} 號</span>
                <span className="text-[15px] font-semibold">{s.name}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {m ? '已登記' : '未登記'}・量表 {scales}/7
                </span>
              </div>
              <Notes marks={marks} className="mt-1 text-[13px]" />
            </button>
          )
        })}
      </div>

      {/* 電腦：表格 */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">座號</th>
              <th className="px-3 py-2 font-medium">姓名</th>
              <th className="px-3 py-2 font-medium">身體數值</th>
              <th className="px-3 py-2 font-medium">BMI</th>
              <th className="px-3 py-2 font-medium">需要注意</th>
              <th className="px-3 py-2 font-medium">自我檢測</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const { m, marks, scales } = line(s)
              return (
                <tr
                  key={s.student_id}
                  onClick={() => onOpen(s.student_id)}
                  className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                    hasRed(marks) ? 'bg-[#FBEDEC]' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">{s.seat_no ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">{s.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{m ? '已登記' : '未登記'}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    <Val v={computed(m).bmi} mark={marks.bmi} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Notes marks={marks} className="text-[13px]" />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">{scales} / 7</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-400">看明細 ›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const SCALE_KEYS = ['lifestyle', 'h85210', 'pyramid', 'sleep', 'mood', 'stress', 'depression'] as const

/**
 * 「需要注意」那一欄。每一項各自照自己的顏色，不是整欄都塗紅——
 * 整欄塗紅的話，只有 BMI 略高的人看起來會跟血壓要重測的人一樣嚴重。
 */
function Notes({ marks, className = '' }: { marks: Marks; className?: string }) {
  const items = markList(marks)
  if (items.length === 0) return null
  return (
    <p className={`font-medium ${className}`}>
      {items.map((m, i) => (
        <span key={m.key} className={m.mark.tone === 'red' ? 'text-[#A8403C]' : 'text-[#8A5310]'}>
          {i > 0 && <span className="text-slate-400">、</span>}
          {m.label} {m.mark.note}
        </span>
      ))}
    </p>
  )
}

function Val({ v, mark }: { v: number | null; mark?: Mark }) {
  if (v === null) return <span className="text-slate-300">—</span>
  return (
    <span className={mark ? (mark.tone === 'red' ? 'font-bold text-[#A8403C]' : 'font-bold text-[#8A5310]') : ''}>
      {v.toFixed(1)}
    </span>
  )
}

/* ------------------------------------------------------------------ 明細 */

/** 自動計算的三個值插在相關欄位後面，順序照原型 */
const AFTER: Record<string, 'bmi' | 'fat' | 'whr'> = {
  weight_kg: 'bmi', body_fat_pct: 'fat', hip_cm: 'whr',
}

function Sheet({ student, className, round, onRound, onClose }: {
  student: DetailStudent
  className: string
  round: MeasurementRound
  onRound: (r: MeasurementRound) => void
  onClose: () => void
}) {
  const m = student.rounds[round]
  const base = student.rounds.initial
  const marks = marksOf(m)
  const c = computed(m)
  const cBase = computed(base)
  const done = ROUNDS.filter((r) => student.rounds[r.key])
  // 期初以外的那幾次才談趨勢；只有一筆時沒有東西可比
  const trend = done.length > 1 && round !== 'initial' && base !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-xl overflow-auto rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-slate-200 bg-white px-5 pb-3 pt-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold">{student.name}</h2>
            <span className="text-sm text-slate-500">
              {className} 班　{student.seat_no ?? '—'} 號　{student.student_no}
            </span>
            <button onClick={onClose} className="ml-auto text-sm text-slate-400 hover:text-slate-700">
              關閉
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs">
              {ROUNDS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => onRound(r.key)}
                  className={`px-2.5 py-1 ${
                    r.key === round
                      ? 'bg-slate-700 font-bold text-white'
                      : student.rounds[r.key] ? 'bg-white text-slate-600' : 'bg-white text-slate-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {m ? new Date(m.measured_at).toLocaleString('zh-TW', { hour12: false }) : '這一次還沒登記'}
            </span>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section>
            <H>身體數值</H>
            {!m ? (
              <p className="text-sm text-slate-500">
                這位同學還沒登記{ROUNDS.find((r) => r.key === round)!.label}的數值。
              </p>
            ) : (
              <div>
                {SECTIONS.map((sec) => (
                  <div key={sec.title}>
                    <p className="mt-3 text-xs font-medium text-slate-400">{sec.title}</p>
                    {sec.fields.map((f) => (
                      <Fragmentish key={f.key}>
                        <Row
                          label={f.label}
                          unit={f.unit}
                          value={raw(m, f)}
                          base={trend ? raw(base, f) : null}
                          mark={marks[f.key as MarkKey]}
                        />
                        {AFTER[f.key] === 'bmi' && (
                          <Row label="BMI" unit="" calc digits={1} value={c.bmi} base={trend ? cBase.bmi : null} mark={marks.bmi} />
                        )}
                        {AFTER[f.key] === 'fat' && (
                          <Row label="體脂重量" unit="kg" calc digits={1} value={c.fatKg} base={trend ? cBase.fatKg : null} />
                        )}
                        {AFTER[f.key] === 'whr' && (
                          <Row label="腰臀比" unit="" calc digits={2} value={c.whr} base={trend ? cBase.whr : null} mark={marks.whr} />
                        )}
                      </Fragmentish>
                    ))}
                  </div>
                ))}
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  只標記有議定門檻的項目：BMI（國健署 18 歲男生）、腰臀比、血壓、脈搏、血氧。
                  體脂率、內臟脂肪、骨骼肌率等沒有標記，不是代表正常，是還沒有可以照的標準。
                </p>
              </div>
            )}
          </section>

          <section>
            <H>自我檢測</H>
            <SelfcheckBlock student={student} />
          </section>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-700 py-3 text-base font-bold text-white"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}

/** 只是為了在 map 裡回傳兩個兄弟節點，不想每個 Row 多包一層 div 壞掉版面 */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function raw(m: HealthMeasurement | null, f: Field): number | string | null {
  if (!m) return null
  const v = (m as unknown as Record<string, unknown>)[f.key]
  return v === null || v === undefined || v === '' ? null : (v as number | string)
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 border-b border-slate-200 pb-1 text-sm font-bold">{children}</h3>
}

function Row({ label, unit, value, base, mark, calc, digits }: {
  label: string
  unit: string
  value: number | string | null
  base?: number | string | null
  mark?: Mark
  calc?: boolean
  /** 自動計算的值固定小數位，免得 BMI 一下 21、一下 22.1 看起來不像同一欄 */
  digits?: number
}) {
  const tone = mark?.tone
  const diff = typeof value === 'number' && typeof base === 'number'
    ? Math.round((value - base) * 10) / 10 : null
  const shown = typeof value === 'number' && digits !== undefined
    ? value.toFixed(digits) : value
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 py-2 text-[15px] last:border-0 ${
        tone === 'red' ? '-mx-2 rounded-md border-transparent bg-[#FBEDEC] px-2' : ''
      }`}
    >
      <span className="text-slate-500">
        {label}
        {calc && <span className="ml-1.5 text-[11px] text-slate-400">自動計算</span>}
      </span>
      <span className="flex items-baseline gap-1.5">
        {diff !== null && diff !== 0 && (
          <span className="text-xs tabular-nums text-slate-400">
            {diff > 0 ? '+' : ''}{diff}
          </span>
        )}
        <span className={`font-semibold tabular-nums ${
          tone === 'red' ? 'text-[#A8403C]' : tone === 'amber' ? 'text-[#8A5310]' : ''
        }`}>
          {shown === null ? <span className="font-normal text-slate-300">—</span> : shown}
        </span>
        {unit && value !== null && <span className="text-xs text-slate-400">{unit}</span>}
        {mark && (
          <span className={`ml-1 text-xs font-bold ${
            mark.tone === 'red' ? 'text-[#A8403C]' : 'text-[#8A5310]'
          }`}>
            {mark.note}
          </span>
        )}
      </span>
    </div>
  )
}

function SelfcheckBlock({ student }: { student: DetailStudent }) {
  const sc = student.selfcheck
  const o = (k: (typeof SCALE_KEYS)[number]) => outcomeFromRow(sc, k)

  const life = o('lifestyle')
  const h = o('h85210')
  const pyr = o('pyramid')
  const sleep = o('sleep')
  const mood = o('mood')
  const stress = o('stress')
  const dep = o('depression')
  const plate = sc?.plate ?? null

  if (!sc) return <p className="text-sm text-slate-500">這位同學還沒做任何一份自我檢測。</p>

  return (
    <div className="space-y-2.5 text-[14px]">
      <Item name="生活型態" done={!!life}>
        {life?.zones && (
          <>
            綠燈 {life.zones.green.length} 題・黃燈 {life.zones.yellow.length} 題・
            <span className="font-semibold text-[#A8403C]">紅燈 {life.zones.red.length} 題</span>
            {life.zones.red.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-slate-600">
                {life.zones.red.map((n) => (
                  <li key={n}>{(SCALES.lifestyle.qs ?? [])[n - 1] as string}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Item>

      <Item name="85210" done={!!h}>
        {h && (
          <>
            做到 {h.score} / 7 項
            <div className="mt-1 flex flex-wrap gap-1">
              {H85210_KEYS.map((k) => {
                const ok = sc.h85210?.[k] === true
                return (
                  <span
                    key={k}
                    className={`rounded-md px-1.5 py-0.5 text-[12px] ${
                      ok ? 'bg-[#E3F1ED] text-[#12776E]' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {ok ? '✓' : '○'} {H85210_SHORT[k] ?? k}
                  </span>
                )
              })}
            </div>
          </>
        )}
      </Item>

      <Item name="飲食金字塔" done={!!pyr}>
        {pyr?.dietType && `${pyr.dietType}　${SCALES.pyramid.results![pyr.dietType].nm}`}
      </Item>

      <Item name="睡眠檢測" done={!!sleep}>
        {sleep && `${sleep.score} 分・${sleep.band?.label ?? ''}`}
      </Item>

      <Item name="心情溫度計" done={!!mood} flag={mood?.flag}>
        {mood && `${mood.score} 分・${mood.band?.label ?? ''}`}
      </Item>

      <Item name="壓力偵測站" done={!!stress} flag={stress?.flag}>
        {stress && `${stress.score} 項・${stress.band?.label ?? ''}`}
      </Item>

      <Item name="情緒自我檢視表" done={!!dep} flag={dep?.flag}>
        {dep && (
          <>
            {dep.score} 分・{dep.band?.label ?? ''}
            {dep.critical && (
              <span className="ml-2 rounded-md bg-[#A8403C] px-1.5 py-0.5 text-[12px] font-bold text-white">
                第 20 題勾選
              </span>
            )}
          </>
        )}
      </Item>

      <Item name="我的餐盤" done={!!plate}>
        {plate && (
          <>
            通過 {plate.matched} / {plate.total} 條・{plate.kcal} 大卡（建議 {plate.kcalTarget}）
            <div className="mt-1 text-[13px] text-slate-600">
              {CAT_KEYS.map((k) => `${CAT[k].nm} ${plate[k]}`).join('　')}
            </div>
            <div className="text-[13px] text-slate-600">
              喝水 {plate.water} c.c.・含糖飲料 {plate.sugar} c.c.
            </div>
          </>
        )}
      </Item>

      {sc.needs_followup && (
        <p className="rounded-lg border border-[#E7C4C2] bg-[#FBEDEC] px-3 py-2 text-[13px] text-[#A8403C]">
          這位同學在 <Link to="/health/teacher" className="underline">需要關心的學生</Link> 名單上。
        </p>
      )}
      <p className="text-xs text-slate-400">
        自我檢測最後更新：{new Date(sc.updated_at).toLocaleString('zh-TW', { hour12: false })}
      </p>
    </div>
  )
}

function Item({ name, done, flag, children }: {
  name: string; done: boolean; flag?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="border-b border-slate-100 pb-2 last:border-0">
      <div className="flex items-baseline gap-2">
        <span className="w-28 shrink-0 text-slate-500">{name}</span>
        <span className={`flex-1 ${flag ? 'font-semibold text-[#A8403C]' : ''}`}>
          {done ? children : <span className="text-slate-300">還沒做</span>}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 外框 */

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-semibold">學生明細</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">班級管理</Link>
          <button onClick={() => void signOut()} className="text-sm text-slate-500 hover:text-slate-900">
            登出
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  )
}

function Box({ tone, children }: { tone?: 'error'; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-[#E7C4C2] bg-[#FBEDEC] text-[#A8403C]'
        : 'border-slate-200 bg-white text-slate-600'
    }`}>
      {children}
    </div>
  )
}
