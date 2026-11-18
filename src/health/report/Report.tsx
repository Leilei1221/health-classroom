import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import HealthHeader, { PreviewBanner } from '../Header'
import { getMeasurement, semesterKey } from '../api'
import {
  MAIN_METRICS, MUSCLE_METRICS, SUBCUT_METRICS,
  bodyAgeComment, compare, highlightSentence, highlights, signed, type Row,
} from './compare'
import type { HealthMeasurement, StudentProfile } from '../../lib/types'

/**
 * 學生端「期末成果」：期初 vs 期末。
 *
 * 取代 114 學年用 Google 文件合併列印的學習單，內容一樣是
 * 「每一項的期初、期末、增減＋身體年齡評語」，多了長條圖與進步亮點。
 *
 * 唯讀，不寫資料庫。學生要改數字回登記頁重送。
 * 列印／另存 PDF 走瀏覽器列印（規格第七項：不用 jsPDF，中文字型會出問題）。
 *
 * 用色：期初淡灰藍、期末主色藍，兩色只代表「哪一次」，不代表好壞。
 * 學生端不出現紅色（規格第八節第 1 條），變多變少都用同一種字色。
 */

const C_BEFORE = '#B9C6D4'
const C_AFTER = '#4F6F92'

export default function Report({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [data, setData] = useState<{
    initial: HealthMeasurement | null
    final: HealthMeasurement | null
  } | null>(isPreview ? { initial: PREVIEW_INITIAL, final: PREVIEW_FINAL } : null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student || isPreview) return
    let cancelled = false
    Promise.all([
      getMeasurement(student.email, semester, 'initial'),
      getMeasurement(student.email, semester, 'final'),
    ])
      .then(([initial, final]) => { if (!cancelled) setData({ initial, final }) })
      .catch(() => { if (!cancelled) setError('資料一時讀不到，重新整理看看。') })
    return () => { cancelled = true }
  }, [student, semester, isPreview])

  if (!student) return null

  return (
    <div className="glass-page-mesh min-h-screen text-mist-ink print:bg-white">
      <div className="mx-auto max-w-[720px] pb-20 print:max-w-none print:pb-0">
        <div className="print:hidden">
          <HealthHeader student={student} isPreview={isPreview} tab="report" />
          {isPreview && (
            <PreviewBanner>這是範例數字，不是任何學生的資料。</PreviewBanner>
          )}
        </div>
        {/* 列印時頁首的分頁列不要，改印一行身分 */}
        <div className="hidden px-1 pb-2 print:block">
          <h1 className="text-lg font-bold">期末健康成果　{student.name}</h1>
          <p className="text-xs">
            {student.class_name} 班・座號 {student.seat_no ?? '—'}・
            {student.academic_year} 學年度第 {student.semester} 學期
          </p>
        </div>

        {error ? (
          <Note>{error}</Note>
        ) : data === null ? (
          <Note>載入中…</Note>
        ) : !data.final ? (
          <Note>
            還沒有期末的測量紀錄。量完之後到
            <Link to="/health/register" className="mx-1 font-bold text-[#3F5F82] underline">身體數值登記</Link>
            填好，這一頁就會出現你這學期的變化。
          </Note>
        ) : !data.initial ? (
          <Note>
            找不到你這學期期初的紀錄，所以沒辦法比較。
            如果你期初有量，可能是當時沒有送出成功，請跟老師說一聲。
          </Note>
        ) : (
          <Body a={data.initial} b={data.final} isPreview={isPreview} />
        )}
      </div>
    </div>
  )
}

function Body({ a, b, isPreview }: { a: HealthMeasurement; b: HealthMeasurement; isPreview: boolean }) {
  const main = useMemo(() => compare(MAIN_METRICS, a, b), [a, b])
  const subcut = useMemo(() => compare(SUBCUT_METRICS, a, b), [a, b])
  const muscle = useMemo(() => compare(MUSCLE_METRICS, a, b), [a, b])

  const ageBefore = a.body_age === null ? null : Number(a.body_age)
  const ageAfter = b.body_age === null ? null : Number(b.body_age)
  const ageDelta = ageBefore === null || ageAfter === null ? null : ageAfter - ageBefore
  const comment = bodyAgeComment(ageDelta)
  const bright = highlightSentence(highlights(a, b))

  return (
    <>
      {/* 身體年齡：去年學習單的主角，放最上面 */}
      <section className="glass mx-3 mt-3.5 rounded-3xl p-5 print:mx-0 print:break-inside-avoid print:border print:border-[#B9C6D4] print:shadow-none">
        <h2 className="text-[13px] font-bold tracking-[0.12em] text-mist-deep">你的健康成績單</h2>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <AgeStat label="期初身體年齡" value={ageBefore} muted />
          <span aria-hidden className="pb-2 text-2xl text-mist-mute">→</span>
          <AgeStat label="期末身體年齡" value={ageAfter} />
          {ageDelta !== null && (
            <div className="pb-1.5">
              <span className="rounded-full bg-[#E4ECF4] px-3 py-1 text-sm font-bold tabular-nums text-[#2B3A4A]">
                {ageDelta === 0 ? '持平' : `${signed(ageDelta, 0)} 歲`}
              </span>
            </div>
          )}
        </div>
        <p className="mt-4 text-[17px] font-bold leading-relaxed text-[#2B3A4A]">
          {comment ?? '期初或期末少了身體年齡，這一項沒辦法比較。'}
        </p>
        {bright && (
          <p className="mt-2 rounded-2xl bg-[#EAF3F1] px-4 py-3 text-[15px] leading-relaxed text-[#24534D]">
            {bright}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-mist-mute">
          身體年齡是體脂機依體重、體脂、肌肉推算出來的參考值，不是醫學診斷。
          同一天不同時間量也會有差，看大方向就好。
        </p>
      </section>

      <Legend />

      <Panel title="主要數值" hint="每一項各自一把尺，長條從 0 開始畫">
        {main.map((r) => <PairBar key={r.metric.key} row={r} />)}
      </Panel>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-3 sm:px-3 print:grid-cols-2 print:gap-3">
        <Panel title="皮下脂肪率" hint="各部位，單位 %" inGrid>
          {subcut.map((r) => <PairBar key={r.metric.key} row={r} />)}
        </Panel>
        <Panel title="骨骼肌率" hint="各部位，單位 %" inGrid>
          {muscle.map((r) => <PairBar key={r.metric.key} row={r} />)}
        </Panel>
      </div>

      <Panel title="完整數字表" hint="圖表的每一個數字都在這裡">
        <NumberTable groups={[
          ['主要數值', main],
          ['皮下脂肪率', subcut],
          ['骨骼肌率', muscle],
        ]} />
      </Panel>

      <div className="mx-3 mt-4 flex flex-col gap-2.5 print:hidden">
        {/* 期末送出後會直接跳來這一頁，抄錯數字要有路回去改 */}
        <Link
          to={isPreview ? '/health/register/preview' : '/health/register'}
          className="w-full rounded-xl border border-mist-main/25 bg-white py-3 text-center text-[15px] font-medium text-[#3F5F82]"
        >
          數字抄錯了？回去修改期末數值
        </Link>
        <button
          onClick={() => window.print()}
          className="w-full rounded-xl bg-[#4F6F92] py-3.5 text-[15px] font-bold text-white"
        >
          列印／另存成 PDF
        </button>
        <p className="text-center text-xs text-mist-mute">
          手機上按下去會跳出列印畫面，印表機選「另存為 PDF」就能存檔
        </p>
      </div>
    </>
  )
}

function AgeStat({ label, value, muted }: { label: string; value: number | null; muted?: boolean }) {
  return (
    <div>
      <div className="text-xs text-mist-mute">{label}</div>
      <div className={`text-[40px] font-bold leading-none tabular-nums ${muted ? 'text-[#7D8FA3]' : 'text-[#2B3A4A]'}`}>
        {value ?? '—'}
        <span className="ml-1 text-base font-medium">歲</span>
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mx-3 mt-4 flex items-center gap-4 px-1 text-[13px] text-[#44556A] print:mx-0">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-[4px]" style={{ background: C_BEFORE }} />期初
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-[4px]" style={{ background: C_AFTER }} />期末
      </span>
    </div>
  )
}

function Panel({ title, hint, inGrid, children }: {
  title: string; hint: string; inGrid?: boolean; children: React.ReactNode
}) {
  return (
    <section className={`glass mt-3 overflow-hidden rounded-3xl print:break-inside-avoid print:border print:border-[#B9C6D4] print:shadow-none ${inGrid ? 'mx-3 sm:mx-0 print:mx-0' : 'mx-3 print:mx-0'}`}>
      <div className="border-b border-white/70 bg-white/40 px-4 pb-2.5 pt-3">
        <h3 className="text-base font-bold">{title}</h3>
        <p className="text-xs text-[#44556A]">{hint}</p>
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  )
}

/**
 * 一項指標＝兩條橫長條（期初在上、期末在下），各自從 0 開始。
 * 每一項的尺度只看自己這兩個數字：體重 60 和血氧 98 放在同一把尺上沒有意義。
 */
function PairBar({ row }: { row: Row }) {
  const { metric, before, after, delta } = row
  const max = Math.max(before ?? 0, after ?? 0)
  const w = (v: number | null) => (v === null || max <= 0 ? 0 : (v / max) * 100)
  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(metric.dp))
  const unit = metric.unit ? ` ${metric.unit}` : ''
  const improved = delta !== null && metric.better !== null && delta !== 0
    && (metric.better === 'up' ? delta > 0 : delta < 0)

  return (
    <div className="border-b border-[#EEF2F6] py-2.5 last:border-0 print:break-inside-avoid">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-bold">
          {metric.label}
          {metric.unit && <span className="ml-1 text-xs font-normal text-mist-mute">{metric.unit}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[13px] tabular-nums text-[#2B3A4A]">
          {delta === null ? '—' : delta === 0 ? '持平' : signed(delta, metric.dp)}
          {improved && (
            <span className="rounded-full bg-[#EAF3F1] px-2 py-0.5 text-[11px] font-bold text-[#24534D]">進步</span>
          )}
        </span>
      </div>
      {([['期初', before, C_BEFORE], ['期末', after, C_AFTER]] as const).map(([name, v, c]) => (
        <div
          key={name}
          className="flex items-center gap-2 py-[2px]"
          title={`${metric.label}・${name}：${fmt(v)}${unit}`}
        >
          <span className="w-7 shrink-0 text-[11px] text-mist-mute">{name}</span>
          <div className="relative h-3 flex-1">
            <div
              className="h-3 rounded-r-[4px] print:[print-color-adjust:exact]"
              style={{ width: `${w(v)}%`, background: c, WebkitPrintColorAdjust: 'exact' }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-[12.5px] tabular-nums text-[#2B3A4A]">{fmt(v)}</span>
        </div>
      ))}
    </div>
  )
}

function NumberTable({ groups }: { groups: [string, Row[]][] }) {
  const fmt = (v: number | null, dp: number) => (v === null ? '—' : v.toFixed(dp))
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead>
        <tr className="text-left text-xs text-mist-mute">
          <th className="py-1.5 font-medium">項目</th>
          <th className="py-1.5 text-right font-medium">期初</th>
          <th className="py-1.5 text-right font-medium">期末</th>
          <th className="py-1.5 text-right font-medium">增減</th>
        </tr>
      </thead>
      {groups.map(([name, rows]) => (
        <tbody key={name}>
          <tr><th colSpan={4} className="pb-1 pt-3 text-left text-xs font-bold text-mist-deep">{name}</th></tr>
          {rows.map(({ metric, before, after, delta }) => (
            <tr key={metric.key} className="border-t border-[#EEF2F6]">
              <td className="py-1.5">
                {metric.label}
                {metric.unit && <span className="ml-1 text-[11px] text-mist-mute">{metric.unit}</span>}
              </td>
              <td className="py-1.5 text-right">{fmt(before, metric.dp)}</td>
              <td className="py-1.5 text-right font-bold">{fmt(after, metric.dp)}</td>
              <td className="py-1.5 text-right">
                {delta === null ? '—' : delta === 0 ? '0' : signed(delta, metric.dp)}
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass mx-3 mt-3.5 rounded-3xl px-5 py-6 text-[15px] leading-relaxed text-[#44556A]">
      {children}
    </div>
  )
}

/* ------------------------------------------------------------ 預覽用範例 */

/** 範例數字是編的，不是任何學生的資料；預覽不讀資料庫 */
const PREVIEW_BASE = {
  id: 'preview', student_email: 'spreview@hlhs.hlc.edu.tw', semester: '115-1',
  machine_no: '3', height_cm: 172.0,
}

const PREVIEW_INITIAL: HealthMeasurement = {
  ...PREVIEW_BASE, measured_at: '2026-09-04', round: 'initial',
  weight_kg: 66.4, body_fat_pct: 21.8, visceral_fat: 6, bmr_kcal: 1580, body_age: 24,
  waist_cm: 80.5, hip_cm: 95.0, sbp: 122, dbp: 74, pulse: 82, spo2: 98,
  subcut_whole: 15.2, subcut_trunk: 13.8, subcut_arms: 20.1, subcut_legs: 16.4,
  muscle_whole: 35.6, muscle_trunk: 30.2, muscle_arms: 40.5, muscle_legs: 52.3,
}

const PREVIEW_FINAL: HealthMeasurement = {
  ...PREVIEW_BASE, measured_at: '2026-12-25', round: 'final',
  weight_kg: 66.9, body_fat_pct: 20.6, visceral_fat: 5, bmr_kcal: 1612, body_age: 22,
  waist_cm: 78.5, hip_cm: 95.5, sbp: 118, dbp: 72, pulse: 76, spo2: 98,
  subcut_whole: 14.5, subcut_trunk: 13.0, subcut_arms: 19.6, subcut_legs: 15.9,
  muscle_whole: 36.8, muscle_trunk: 31.0, muscle_arms: 41.2, muscle_legs: 53.6,
}
