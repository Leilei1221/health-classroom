import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import type { HealthMeasurement, HealthSelfcheck, StudentProfile } from '../../lib/types'
import HealthHeader, { PreviewBanner } from '../Header'
import Handover from '../Handover'
import { ROUND, getMeasurement, getSelfcheck, semesterKey } from '../api'
import { riskLevel, type RiskLevel } from '../riskLevel'
import RiskCare from '../selfcheck/RiskCare'
import { analyzeStudent, type FocusItem, type Signal } from './engine'
import BreathingGuide from './BreathingGuide'
import GratitudeJournal from './GratitudeJournal'
import { mindBodyStrategies, type MindBodyStrategy } from './mentalStrategies'

const SAMPLE_MEASUREMENT: HealthMeasurement = {
  id: 'preview',
  student_email: 'spreview@hlhs.hlc.edu.tw',
  semester: '115-1',
  measured_at: '2026-09-21',
  round: ROUND,
  machine_no: 'P1',
  height_cm: 172,
  weight_kg: 76,
  body_fat_pct: 23,
  visceral_fat: 9,
  bmr_kcal: 1700,
  body_age: 19,
  waist_cm: 88,
  hip_cm: 94,
  sbp: 128,
  dbp: 78,
  pulse: 78,
  spo2: 98,
  subcut_whole: 16,
  subcut_trunk: 18,
  subcut_arms: 14,
  subcut_legs: 17,
  muscle_whole: 35,
  muscle_trunk: 30,
  muscle_arms: 38,
  muscle_legs: 42,
}

const SAMPLE_SELFCHECK: HealthSelfcheck = {
  id: 'preview',
  student_email: 'spreview@hlhs.hlc.edu.tw',
  semester: '115-1',
  lifestyle: { green: [2, 3, 8], yellow: [4, 5, 7, 9], red: [1, 6, 10] },
  h85210: {
    sleep8: false,
    screen_under2: true,
    fruit5: false,
    water1500: false,
    no_sugar_drink: false,
    breakfast: true,
    exercise1h: false,
  },
  diet_type: 'C',
  sleep_isi: 11,
  mood_scale: 4,
  stress_level: 3,
  depression: 2,
  depression_critical: false,
  plate: null,
  needs_followup: false,
  risk_level: 0,
  risk_l3_count: 0,
  risk_flagged_at: null,
  risk_reviewed: false,
  risk_reviewed_at: null,
  risk_outcome: null,
  risk_note: null,
  answered_at: '2026-09-21T00:00:00.000Z',
  created_at: '2026-09-21T00:00:00.000Z',
  updated_at: '2026-09-21T00:00:00.000Z',
}

const DOT: Record<string, string> = {
  g: 'bg-[#2E8B62]',
  y: 'bg-[#D19A2E]',
  o: 'bg-[#B26A12]',
}

export default function Analysis({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [measurement, setMeasurement] = useState<HealthMeasurement | null>(null)
  const [selfcheck, setSelfcheck] = useState<HealthSelfcheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student) return
    if (isPreview) {
      setMeasurement(SAMPLE_MEASUREMENT)
      setSelfcheck(SAMPLE_SELFCHECK)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true); setError('')
    Promise.all([
      getMeasurement(student.email, semester, ROUND),
      getSelfcheck(student.email, semester),
    ])
      .then(([m, sc]) => {
        if (cancelled) return
        setMeasurement(m)
        setSelfcheck(sc)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [student, semester, isPreview])

  const risk = useMemo<RiskLevel>(() => {
    if (selfcheck && selfcheck.risk_level >= 0 && selfcheck.risk_level <= 3) {
      return selfcheck.risk_level as RiskLevel
    }
    return riskLevel({
      mood: selfcheck?.mood_scale ?? null,
      stress: selfcheck?.stress_level ?? null,
      depression: selfcheck?.depression ?? null,
      depressionCritical: selfcheck?.depression_critical === true,
    })
  }, [selfcheck])

  const analysis = useMemo(
    () => analyzeStudent(measurement, selfcheck),
    [measurement, selfcheck],
  )
  const mindStrategies = useMemo(
    () => mindBodyStrategies(selfcheck, analysis.focuses),
    [selfcheck, analysis.focuses],
  )

  if (!student) return null
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>

  return (
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-12">
        <HealthHeader student={student} isPreview={isPreview} tab="analysis" />

        {isPreview && (
          <PreviewBanner>
            這是學生分析頁的預覽資料。畫面會照規則算出建議，但不會讀寫任何資料。
          </PreviewBanner>
        )}
        {error && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">
            {error}
          </div>
        )}

        {risk >= 2 ? (
          <HighRisk risk={risk as 2 | 3} />
        ) : !analysis.ready ? (
          <MissingData hasMeasurement={analysis.hasMeasurement} hasSelfcheck={analysis.hasSelfcheck} />
        ) : (
          <>
            <Hero />
            <SignalOverview signals={analysis.signals} />
            <FocusList focuses={analysis.focuses} />
            <MindBodySection strategies={mindStrategies} />
            <GratitudeJournal />
            <SuggestionList suggestions={analysis.suggestions} />
            <ExerciseList exercises={analysis.exercises} />
            <NextStep />
          </>
        )}

        {!isPreview && <Handover />}
      </div>
    </div>
  )
}

function MindBodySection({ strategies }: { strategies: MindBodyStrategy[] }) {
  if (strategies.length === 0) return null
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">身心調節策略</h3>
        <p className="mt-0.5 text-[13px] text-[#4A6461]">
          依你的壓力、睡眠和情緒檢測，先挑一個今天做得到的方法
        </p>
      </div>
      <div className="divide-y divide-[#C7E2DC]">
        {strategies.map((s) => (
          <article key={s.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[15.5px] font-bold">{s.title}</h4>
              <span className="shrink-0 rounded-full bg-[#E9F5F2] px-2 py-1 text-[11.5px] font-bold text-[#12776E]">
                {tagLabel(s.kind)}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#4A6461]">{s.when}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed">{s.why}</p>
            <ol className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-[#0E2E2B]">
              {s.steps.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="font-bold tabular-nums text-[#12776E]">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {s.kind === 'breathing' && <BreathingGuide />}
          </article>
        ))}
      </div>
    </section>
  )
}

function tagLabel(kind: MindBodyStrategy['kind']): string {
  return {
    breathing: '呼吸',
    sound: '聲音',
    sleep: '睡眠',
    reframe: '轉念',
    sunlight: '日光',
    support: '求助',
    problem: '解題',
  }[kind]
}

function Hero() {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
      <p className="text-[12px] font-bold tracking-widest text-[#12776E]">這學期的起點</p>
      <h2 className="mt-1 text-xl font-bold">先挑一兩件最值得做的事</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
        這裡只用你已經填的資料做規則分析，不排名、不和同學比較，也不算成績。
      </p>
    </section>
  )
}

function SignalOverview({ signals }: { signals: Signal[] }) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">燈號總覽</h3>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3">
        {signals.map((s) => (
          <div key={s.key} className="rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-[#4A6461]">{s.label}</span>
              {s.verdict && <span className={`h-2.5 w-2.5 rounded-full ${DOT[s.verdict.level]}`} />}
            </div>
            <b className="mt-1 block text-xl tabular-nums">{s.value}</b>
            <p className="mt-1 text-[12.5px] leading-snug text-[#4A6461]">
              {s.verdict?.label ?? '資料不足'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FocusList({ focuses }: { focuses: FocusItem[] }) {
  if (focuses.length === 0) {
    return (
      <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
        <h3 className="text-base font-bold">先從這裡開始</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
          你目前沒有特別需要優先處理的項目。下一步可以挑一個想維持的好習慣，寫成四週目標。
        </p>
      </section>
    )
  }
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">先從這裡開始</h3>
      </div>
      <div className="divide-y divide-[#C7E2DC]">
        {focuses.map((f, i) => (
          <article key={f.trigger} className="px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#12776E] text-[12px] font-bold text-white">
                {i + 1}
              </span>
              <h4 className="text-[15.5px] font-bold">{f.title}</h4>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">{f.state.now}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed">{f.state.why}</p>
            <p className="mt-2 rounded-xl bg-[#E9F5F2] px-3 py-2 text-[13.5px] leading-relaxed">
              <b>今天可以先做：</b>{f.firstStep}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function SuggestionList({ suggestions }: {
  suggestions: { id: string; title: string; why: string; how: string; difficulty: number; timeframe: string; firstStep: string }[]
}) {
  if (suggestions.length === 0) return null
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">三個改善建議</h3>
      </div>
      <div className="divide-y divide-[#C7E2DC]">
        {suggestions.map((s) => (
          <article key={s.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[15.5px] font-bold">{s.title}</h4>
              <span className="shrink-0 rounded-full bg-[#E9F5F2] px-2 py-1 text-[11.5px] font-bold text-[#12776E]">
                ★{s.difficulty}・{s.timeframe}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#4A6461]">{s.why}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed">{s.how}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#0E2E2B]">
              <b>第一小步：</b>{s.firstStep}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ExerciseList({ exercises }: {
  exercises: { id: string; name: string; kcal: string; freq: string; plan: string }[]
}) {
  if (exercises.length === 0) return null
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">運動建議</h3>
      </div>
      <div className="divide-y divide-[#C7E2DC]">
        {exercises.map((e) => (
          <article key={e.id} className="px-4 py-3.5">
            <h4 className="text-[15px] font-bold">{e.name}</h4>
            <p className="mt-1 text-[13.5px] text-[#4A6461]">{e.kcal}｜{e.freq}</p>
            <p className="mt-1 text-[14px] leading-relaxed">{e.plan}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function NextStep() {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
      <h3 className="text-base font-bold">下一步</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
        把其中一件事寫成四週 SMART 目標。先想一想：哪一件是你覺得最做得到的？
      </p>
      <Link
        to="/health/goal"
        className="mt-3 block w-full rounded-xl bg-[#12776E] py-3 text-center text-[15px] font-bold text-white"
      >
        前往 SMART 目標設定
      </Link>
    </section>
  )
}

function MissingData({ hasMeasurement, hasSelfcheck }: {
  hasMeasurement: boolean
  hasSelfcheck: boolean
}) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-5">
      <h2 className="text-lg font-bold">還差一點資料</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
        分析頁需要身體數值和自我檢測兩邊都有資料，才不會只看一半就下結論。
      </p>
      <div className="mt-4 space-y-2">
        {!hasMeasurement && (
          <Link to="/health" className="block rounded-xl bg-[#12776E] py-3 text-center text-[15px] font-bold text-white">
            去完成身體數值登記
          </Link>
        )}
        {!hasSelfcheck && (
          <Link to="/health/selfcheck" className="block rounded-xl border border-[#12776E] bg-white py-3 text-center text-[15px] font-bold text-[#12776E]">
            去完成自我檢測
          </Link>
        )}
      </div>
    </section>
  )
}

function HighRisk({ risk }: { risk: 2 | 3 }) {
  return (
    <>
      <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
        <h2 className="text-lg font-bold">你的回答已經記下來了</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
          這一頁先不顯示生活習慣建議。下面這段文字比較重要，請先看完。
        </p>
      </section>
      <RiskCare level={risk} />
      <div className="mx-3 rounded-xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3.5 text-[13px] leading-relaxed text-[#4A6461]">
        生活型態、85210 和餐盤活動仍然可以照常做；這裡只是暫時不把它們包成改善建議。
      </div>
    </>
  )
}
