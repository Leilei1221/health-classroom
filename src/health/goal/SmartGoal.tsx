import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import type { HealthGoal, HealthMeasurement, HealthSelfcheck, StudentProfile } from '../../lib/types'
import HealthHeader, { PreviewBanner } from '../Header'
import Handover from '../Handover'
import {
  ROUND, getHealthGoal, getMeasurement, getSelfcheck, myTeacherName, saveHealthGoal, semesterKey,
} from '../api'
import { riskLevel, type RiskLevel } from '../riskLevel'
import RiskCare from '../selfcheck/RiskCare'
import { analyzeStudent, type FocusItem } from '../analysis/engine'

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
  risk_flagged_at: null,
  risk_reviewed: false,
  risk_reviewed_at: null,
  risk_outcome: null,
  risk_note: null,
  answered_at: '2026-09-21T00:00:00.000Z',
  created_at: '2026-09-21T00:00:00.000Z',
  updated_at: '2026-09-21T00:00:00.000Z',
}

type GoalDraft = {
  direction: string
  selectedOptionIds: string[]
  action: string
  measure: string
  frequency: string
  why: string
  people: string
  place: string
  resources: string
  confidence: number
  reward: string
  week1: string
  week2: string
  week3: string
  week4: string
  goalConfirmed: boolean
  wsqWatch: string
  wsqSummary: string
  wsqQuestion: string
  aiAsk: string
  aiUseful: string
  aiChanged: string
}

type GoalOption = {
  id: string
  label: string
  detail: string
  action: string
  measure: string
  domain: string
}

const DEFAULT_DRAFT: GoalDraft = {
  direction: '',
  selectedOptionIds: [],
  action: '',
  measure: '',
  frequency: '每週 3 天',
  why: '',
  people: '',
  place: '',
  resources: '',
  confidence: 7,
  reward: '',
  week1: '',
  week2: '',
  week3: '',
  week4: '',
  goalConfirmed: false,
  wsqWatch: '',
  wsqSummary: '',
  wsqQuestion: '',
  aiAsk: '',
  aiUseful: '',
  aiChanged: '',
}

const WORKSHEET_OPTIONS: GoalOption[] = [
  {
    id: 'sleep-regular',
    label: '睡眠變穩定',
    detail: '每天睡滿 7-9 小時、睡前放鬆、減少睡前滑手機。',
    action: '睡前 30 分鐘把手機放到書桌，做 5 分鐘伸展或呼吸練習。',
    measure: '用打勾記錄睡前有沒有完成，並寫下上床時間。',
    domain: '睡眠',
  },
  {
    id: 'sunlight',
    label: '白天多接觸陽光',
    detail: '午餐後或下課走到戶外，幫助精神與睡眠節律。',
    action: '午餐後到操場或走廊散步 10 分鐘。',
    measure: '每完成一次就在週表打勾。',
    domain: '活動',
  },
  {
    id: 'gratitude',
    label: '感恩或日記',
    detail: '每天練習寫下值得感謝或做得不錯的一件小事。',
    action: '睡前寫 3 句感恩日記。',
    measure: '一週至少完成 3 次感恩日記。',
    domain: '身心',
  },
  {
    id: 'breathing',
    label: '深呼吸紓壓',
    detail: '在讀書前、考試前或睡前做短時間呼吸練習。',
    action: '讀書前做 3 分鐘正念呼吸，吸氣、停留、吐氣都慢慢來。',
    measure: '記錄每天練習的次數與當下壓力感受。',
    domain: '壓力',
  },
  {
    id: 'exercise',
    label: '累積活動量',
    detail: '每週累積中等強度活動，也可以從樓梯、伸展、散步開始。',
    action: '下課或晚自習後走樓梯、伸展或快走 10 分鐘。',
    measure: '一週至少完成 3 天，每天記錄分鐘數。',
    domain: '活動',
  },
  {
    id: 'water',
    label: '喝水與少糖',
    detail: '帶水壺、下課裝水，含糖飲料先從減量開始。',
    action: '每天帶水壺上學，上午和下午各裝水一次。',
    measure: '記錄今天喝完幾瓶水。',
    domain: '飲食',
  },
  {
    id: 'breakfast',
    label: '早餐吃得穩',
    detail: '早餐加入蛋、豆漿、鮮奶等蛋白質，讓上午比較有精神。',
    action: '早餐加一份蛋白質，例如蛋、無糖豆漿或鮮奶。',
    measure: '一週至少 4 天早餐有蛋白質。',
    domain: '飲食',
  },
  {
    id: 'support',
    label: '建立支持系統',
    detail: '找同學、家人、導師或輔導老師討論卡住的地方。',
    action: '每週找一位可信任的人說一次近況。',
    measure: '記錄本週說了什麼，以及說完後的感受。',
    domain: '身心',
  },
]

const BANNED_GOAL_WORDS = ['公斤', '減重', '瘦', '體重', '體脂', '卡路里', '熱量赤字']

export default function SmartGoal({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [measurement, setMeasurement] = useState<HealthMeasurement | null>(null)
  const [selfcheck, setSelfcheck] = useState<HealthSelfcheck | null>(null)
  const [teacherName, setTeacherName] = useState<string | null>(null)
  const [draft, setDraft] = useState<GoalDraft>(DEFAULT_DRAFT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const storageKey = student && isPreview ? `hc-smart-goal:${student.email}:${semester}:preview` : ''

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
      getHealthGoal(student.email, semester, 1).catch(() => null),
      myTeacherName().catch(() => null),
    ])
      .then(([m, sc, goal, name]) => {
        if (cancelled) return
        setMeasurement(m)
        setSelfcheck(sc)
        if (goal) {
          setDraft(goalToDraft(goal))
          setSavedAt(goal.submitted_at ?? goal.updated_at)
        }
        setTeacherName(name)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [student, semester, isPreview])

  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(raw) })
    } catch {
      /* 本機暫存讀不到時，維持空白草稿。 */
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || loading) return
    localStorage.setItem(storageKey, JSON.stringify(draft))
  }, [draft, storageKey, loading])

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
  const options = useMemo(() => buildOptions(analysis.focuses), [analysis.focuses])
  const prompt = useMemo(() => buildPrompt(draft), [draft])
  const warnings = useMemo(() => validateDraft(draft), [draft])

  if (!student) return null
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>

  const update = <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const chooseOption = (option: GoalOption) => {
    setDraft((d) => {
      const selected = d.selectedOptionIds ?? []
      const hasOption = selected.includes(option.id)
      if (!hasOption && selected.length >= 3) return d
      const selectedOptionIds = hasOption
        ? selected.filter((id) => id !== option.id)
        : [...selected, option.id]
      const selectedLabels = options
        .filter((item) => selectedOptionIds.includes(item.id))
        .map((item) => item.label)
      const firstSelected = options.find((item) => selectedOptionIds.includes(item.id))

      return {
        ...d,
        selectedOptionIds,
        direction: selectedLabels.join('、'),
        action: d.action || firstSelected?.action || '',
        measure: d.measure || firstSelected?.measure || '',
        week1: d.week1 || (firstSelected ? `先做小版本：${firstSelected.action}` : ''),
        week2: d.week2 || '延續第一週，找出最容易失敗的時間點並調整。',
        week3: d.week3 || '在可行的日子增加一次練習，保持不中斷。',
        week4: d.week4 || '整理成果，決定下一輪要維持或微調什麼。',
        goalConfirmed: false,
      }
    })
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const saveDraft = async (confirmed: boolean) => {
    if (isPreview) {
      update('goalConfirmed', confirmed || draft.goalConfirmed)
      setSavedAt(new Date().toISOString())
      return
    }
    if (!student) return
    setSaving(true); setError('')
    const nextDraft = { ...draft, goalConfirmed: confirmed || draft.goalConfirmed }
    try {
      const saved = await saveHealthGoal({
        student_email: student.email,
        semester,
        goal_no: 1,
        selected_options: selectedOptionsForDraft(nextDraft, options),
        direction: nextDraft.direction.trim(),
        s_action: nextDraft.action.trim(),
        m_method: nextDraft.measure.trim(),
        frequency: nextDraft.frequency.trim(),
        target_per_week: targetPerWeek(nextDraft.frequency),
        confidence: nextDraft.confidence,
        why: nullable(nextDraft.why),
        people: nullable(nextDraft.people),
        place: nullable(nextDraft.place),
        resources: nullable(nextDraft.resources),
        reward: nullable(nextDraft.reward),
        week1: nullable(nextDraft.week1),
        week2: nullable(nextDraft.week2),
        week3: nullable(nextDraft.week3),
        week4: nullable(nextDraft.week4),
        ai_prompt: prompt,
        ai_ask: nullable(nextDraft.aiAsk),
        ai_useful: nullable(nextDraft.aiUseful),
        ai_changed: nullable(nextDraft.aiChanged),
        wsq_watch: nullable(nextDraft.wsqWatch),
        wsq_summary: nullable(nextDraft.wsqSummary),
        wsq_question: nullable(nextDraft.wsqQuestion),
        confirmed: nextDraft.goalConfirmed,
        status: nextDraft.goalConfirmed ? 'active' : 'draft',
        submitted_at: new Date().toISOString(),
      })
      setDraft(goalToDraft(saved))
      setSavedAt(saved.submitted_at ?? saved.updated_at)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-12">
        <HealthHeader student={student} isPreview={isPreview} tab="goal" />

        {isPreview && (
          <PreviewBanner>
            這是 SMART 目標頁預覽。草稿只會暫存在這台裝置，不會寫入資料庫。
          </PreviewBanner>
        )}
        {error && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">
            {error}
          </div>
        )}

        {risk >= 2 ? (
          <HighRiskGoal teacherName={teacherName} risk={risk as 2 | 3} />
        ) : (
          <>
            <Intro ready={analysis.ready} />
            <DirectionPicker
              options={options}
              selectedIds={draft.selectedOptionIds ?? []}
              onChoose={chooseOption}
            />
            <SmartEditor draft={draft} warnings={warnings} onChange={update} />
            <AiPromptPanel prompt={prompt} copied={copied} onCopy={copyPrompt} />
            <ConfirmGoal
              confirmed={draft.goalConfirmed}
              disabled={warnings.some((w) => w.includes('至少'))}
              saving={saving}
              savedAt={savedAt}
              onConfirm={() => void saveDraft(true)}
            />
            {draft.goalConfirmed && (
              <WsqReflection
                draft={draft}
                onChange={update}
                saving={saving}
                savedAt={savedAt}
                onSave={() => void saveDraft(true)}
              />
            )}
            <SaveNote isPreview={isPreview} />
          </>
        )}

        {!isPreview && <Handover />}
      </div>
    </div>
  )
}

function buildOptions(focuses: FocusItem[]): GoalOption[] {
  const fromAnalysis = focuses.map((f) => ({
    id: `focus-${f.trigger}`,
    label: domainLabel(f.domain),
    detail: f.state.now,
    action: f.firstStep,
    measure: '用一週表格記錄完成的天數與感受。',
    domain: domainLabel(f.domain),
  }))
  const seen = new Set<string>()
  return [...fromAnalysis, ...WORKSHEET_OPTIONS].filter((item) => {
    const key = `${item.label}:${item.action}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

function domainLabel(domain: FocusItem['domain']): string {
  return {
    sleep: '睡眠變穩定',
    diet: '飲食更均衡',
    activity: '累積活動量',
    stress: '壓力調節',
    hydration: '喝水與少糖',
    screen: '螢幕時間調整',
  }[domain]
}

function validateDraft(draft: GoalDraft): string[] {
  const joined = `${draft.direction} ${draft.action} ${draft.measure} ${draft.frequency}`
  const warnings: string[] = []
  if ((draft.selectedOptionIds ?? []).length === 0 && !draft.direction.trim()) {
    warnings.push('請至少選一個健康方向，最多選三個。')
  }
  if (BANNED_GOAL_WORDS.some((word) => joined.includes(word))) {
    warnings.push('目標請改成「行為」而不是體重、公斤、體脂或熱量。')
  }
  if (draft.confidence < 7) {
    warnings.push('信心分數低於 7 分時，建議把目標再縮小一點。')
  }
  if (!draft.action || !draft.measure || !draft.frequency) {
    warnings.push('SMART 至少要寫出行動、測量方式和時間頻率。')
  }
  return warnings
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function targetPerWeek(frequency: string): number {
  const match = frequency.match(/[1-7]/)
  const value = match ? Number(match[0]) : 3
  return Math.min(7, Math.max(3, value))
}

function selectedOptionsForDraft(
  draft: GoalDraft,
  options: GoalOption[],
): { id: string; label: string; domain: string }[] {
  return options
    .filter((option) => draft.selectedOptionIds.includes(option.id))
    .map((option) => ({ id: option.id, label: option.label, domain: option.domain }))
}

function goalToDraft(goal: HealthGoal): GoalDraft {
  return {
    direction: goal.direction ?? '',
    selectedOptionIds: (goal.selected_options ?? []).map((option) => option.id),
    action: goal.s_action ?? '',
    measure: goal.m_method ?? '',
    frequency: goal.frequency ?? '每週 3 天',
    why: goal.why ?? '',
    people: goal.people ?? '',
    place: goal.place ?? '',
    resources: goal.resources ?? '',
    confidence: goal.confidence ?? 7,
    reward: goal.reward ?? '',
    week1: goal.week1 ?? '',
    week2: goal.week2 ?? '',
    week3: goal.week3 ?? '',
    week4: goal.week4 ?? '',
    goalConfirmed: goal.confirmed === true,
    wsqWatch: goal.wsq_watch ?? '',
    wsqSummary: goal.wsq_summary ?? '',
    wsqQuestion: goal.wsq_question ?? '',
    aiAsk: goal.ai_ask ?? '',
    aiUseful: goal.ai_useful ?? '',
    aiChanged: goal.ai_changed ?? '',
  }
}

function buildPrompt(draft: GoalDraft): string {
  const safe = (v: string, fallback: string) => v.trim() || fallback
  return [
    '我是一位高中生，正在為健康管理課設計四週 SMART 目標。',
    '',
    '請你扮演「健康課學習夥伴」，幫我把下面的草稿整理成 2-3 個可選版本。',
    '',
    `我的方向：${safe(draft.direction, '還沒確定，請先問我 2 個澄清問題')}`,
    `我想做的行動：${safe(draft.action, '尚未填寫')}`,
    `我想怎麼測量：${safe(draft.measure, '尚未填寫')}`,
    `頻率或時間：${safe(draft.frequency, '尚未填寫')}`,
    `我想達成的原因：${safe(draft.why, '尚未填寫')}`,
    `可能幫助我的人：${safe(draft.people, '尚未填寫')}`,
    `執行場所：${safe(draft.place, '尚未填寫')}`,
    `可用資源：${safe(draft.resources, '尚未填寫')}`,
    `目前信心分數：${draft.confidence}/10`,
    '',
    '請遵守：',
    '1. 不要用體重、公斤、體脂、熱量赤字當目標。',
    '2. 目標要是可執行的生活行為，適合高中生四週內練習。',
    '3. 如果資訊不足，先問我問題，不要直接替我決定。',
    '4. 請用 SMART 欄位輸出：S 明確、M 可測量、A 可實現、R 合理、T 時限。',
    '5. 最後給我一個「第一週最小行動」。',
  ].join('\n')
}

function Intro({ ready }: { ready: boolean }) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
      <p className="text-[12px] font-bold tracking-widest text-[#12776E]">SMART 目標工作台</p>
      <h2 className="mt-1 text-xl font-bold">把建議變成四週做得到的計畫</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
        先從分析或學習單的小行動挑一項，再用 AI 提問稿幫自己檢查目標是否清楚、可測量、可執行。
      </p>
      {!ready && (
        <div className="mt-3 rounded-xl border border-[#E2C9A6] bg-[#FDF3E3] px-3 py-2 text-[13px] leading-relaxed text-[#8A5310]">
          目前資料還不完整，也可以先用下方通用方向練習寫目標。
        </div>
      )}
    </section>
  )
}

function DirectionPicker({ options, selectedIds, onChoose }: {
  options: GoalOption[]
  selectedIds: string[]
  onChoose: (option: GoalOption) => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">1. 選 1-3 個健康方向</h3>
        <p className="mt-0.5 text-[13px] text-[#4A6461]">一個就很好，最多三個。先求穩定，不求多。</p>
      </div>
      <div className="border-b border-[#C7E2DC] px-4 py-2 text-[12.5px] font-bold text-[#12776E]">
        已選 {selectedIds.length}/3
      </div>
      <div className="grid gap-2.5 p-3">
        {options.map((option) => {
          const on = selectedIds.includes(option.id)
          const disabled = !on && selectedIds.length >= 3
          return (
            <button
              key={option.id}
              disabled={disabled}
              onClick={() => onChoose(option)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                on
                  ? 'border-[#12776E] bg-[#E9F5F2]'
                  : disabled
                    ? 'border-[#D8E6E3] bg-slate-50 text-slate-400'
                    : 'border-[#C7E2DC] bg-white hover:bg-[#F7FCFB]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <b className="text-[15px]">{option.label}</b>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-bold text-[#12776E]">
                  {option.domain}
                </span>
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#4A6461]">{option.detail}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SmartEditor({ draft, warnings, onChange }: {
  draft: GoalDraft
  warnings: string[]
  onChange: <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">2. 寫成 SMART 目標</h3>
      </div>
      <div className="space-y-4 p-4">
        <Field label="S 明確：我要做什麼？">
          <TextArea value={draft.action} onChange={(v) => onChange('action', v)} placeholder="例：睡前 30 分鐘把手機放到書桌，做 5 分鐘呼吸練習。" />
        </Field>
        <Field label="M 可測量：我要怎麼知道自己有做到？">
          <TextArea value={draft.measure} onChange={(v) => onChange('measure', v)} placeholder="例：每天在週表打勾，記錄上床時間和完成天數。" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="A 可實現：頻率">
            <input
              value={draft.frequency}
              onChange={(e) => onChange('frequency', e.target.value)}
              className="w-full rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] outline-none focus:border-[#12776E]"
              placeholder="每週 3 天"
            />
          </Field>
          <Field label="信心分數">
            <input
              type="range"
              min={1}
              max={10}
              value={draft.confidence}
              onChange={(e) => onChange('confidence', Number(e.target.value))}
              className="mt-3 w-full accent-[#12776E]"
            />
            <div className="text-center text-[13px] font-bold text-[#12776E]">{draft.confidence}/10</div>
          </Field>
        </div>
        <Field label="R 合理：我為什麼想做？">
          <TextArea value={draft.why} onChange={(v) => onChange('why', v)} placeholder="例：希望晚上的心情比較穩，隔天上課比較有精神。" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Who 誰可以支持我？">
            <TextArea
              value={draft.people}
              onChange={(v) => onChange('people', v)}
              placeholder="例：可以找同學一起參加、家人提醒我、老師或朋友督促我，或找一位會激勵我的人。"
            />
          </Field>
          <Field label="Where 在哪裡做？">
            <TextArea
              value={draft.place}
              onChange={(v) => onChange('place', v)}
              placeholder="例：教室下課、操場、回家路上、房間書桌旁、睡前床邊。"
            />
          </Field>
          <Field label="Which 可以用哪些資源？">
            <TextArea
              value={draft.resources}
              onChange={(v) => onChange('resources', v)}
              placeholder="例：水壺、鬧鐘、週表、感恩日記、呼吸引導、運動場地、同學邀約。"
            />
          </Field>
        </div>
        <Field label="T 時限：四週行動計畫">
          <div className="space-y-2">
            {(['week1', 'week2', 'week3', 'week4'] as const).map((key, i) => (
              <input
                key={key}
                value={draft[key]}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] outline-none focus:border-[#12776E]"
                placeholder={`第 ${i + 1} 週要做的事`}
              />
            ))}
          </div>
        </Field>
        <Field label="達成後給自己的獎勵">
          <SmallInput value={draft.reward} onChange={(v) => onChange('reward', v)} placeholder="例：看一集喜歡的影集、買一杯無糖飲料。" />
        </Field>
        {warnings.length > 0 && (
          <div className="rounded-xl border border-[#E2C9A6] bg-[#FDF3E3] px-3 py-2.5 text-[13px] leading-relaxed text-[#8A5310]">
            {warnings.map((w) => <p key={w}>{w}</p>)}
          </div>
        )}
      </div>
    </section>
  )
}

function AiPromptPanel({ prompt, copied, onCopy }: {
  prompt: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">3. AI 提問腳手架</h3>
        <p className="mt-0.5 text-[13px] text-[#4A6461]">資料不會自動送出，只有你自己複製貼上才會離開這個頁面。</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-5 gap-1.5 text-center text-[11.5px] font-bold text-[#12776E]">
          {['看見現象', '產生疑問', '定義問題', '拆解比較', '回到目的'].map((step) => (
            <div key={step} className="rounded-lg bg-[#E9F5F2] px-1.5 py-2">{step}</div>
          ))}
        </div>
        <div className="rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-3 py-3">
          <p className="text-[13.5px] leading-relaxed text-[#4A6461]">
            這份提問稿把你的目標、情境、限制和輸出格式寫清楚，請 AI 幫你整理，而不是讓 AI 替你決定。
          </p>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[12.5px] leading-relaxed text-[#0E2E2B]">
            {prompt}
          </pre>
          <button
            onClick={() => void onCopy()}
            className="mt-3 w-full rounded-xl bg-[#12776E] py-3 text-[15px] font-bold text-white"
          >
            {copied ? '已複製' : '複製 AI 提問稿'}
          </button>
        </div>
      </div>
    </section>
  )
}

function ConfirmGoal({ confirmed, disabled, saving, savedAt, onConfirm }: {
  confirmed: boolean
  disabled: boolean
  saving: boolean
  savedAt: string | null
  onConfirm: () => void
}) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
      <h3 className="text-base font-bold">4. 確認目標草稿</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
        複製提問稿去問 AI，調整完 SMART 目標後，再回來按確認，下面才會出現 WSQ 反思。
      </p>
      <button
        disabled={disabled || saving}
        onClick={onConfirm}
        className={`mt-3 w-full rounded-xl py-3 text-[15px] font-bold ${
          disabled || saving
            ? 'bg-[#B8CFCC] text-white'
            : confirmed
              ? 'bg-[#E9F5F2] text-[#12776E]'
              : 'bg-[#12776E] text-white'
        }`}
      >
        {saving ? '儲存中…' : confirmed ? '已確認，開始寫 WSQ' : '我已完成目標草稿'}
      </button>
      {savedAt && <SavedText savedAt={savedAt} />}
    </section>
  )
}

function WsqReflection({ draft, onChange, saving, savedAt, onSave }: {
  draft: GoalDraft
  onChange: <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) => void
  saving: boolean
  savedAt: string | null
  onSave: () => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">5. WSQ 學習反思</h3>
      </div>
      <div className="space-y-4 p-4">
        <Field label="W：我看見了什麼？">
          <TextArea value={draft.wsqWatch} onChange={(v) => onChange('wsqWatch', v)} placeholder="例：我發現自己不是沒有時間，而是睡前手機很容易拖到很晚。" />
        </Field>
        <Field label="S：我是怎麼確立這個目標的？">
          <TextArea value={draft.wsqSummary} onChange={(v) => onChange('wsqSummary', v)} placeholder="用 2-3 句話說明：我根據哪些檢測結果、AI 回饋或自己的生活狀況，最後決定這個目標。" />
        </Field>
        <Field label="Q：我還需要問什麼問題？">
          <TextArea value={draft.wsqQuestion} onChange={(v) => onChange('wsqQuestion', v)} placeholder="例：如果段考週做不到原本頻率，我可以怎麼調整但不中斷？" />
        </Field>
        <div className="rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-3 py-3">
          <h4 className="text-[14px] font-bold">AI 使用反思</h4>
          <div className="mt-3 space-y-3">
            <TextArea value={draft.aiAsk} onChange={(v) => onChange('aiAsk', v)} placeholder="我這次怎麼問 AI？我有沒有說清楚情境、目標和限制？" />
            <TextArea value={draft.aiUseful} onChange={(v) => onChange('aiUseful', v)} placeholder="AI 的回答哪裡有幫助？哪裡不適合我？" />
            <TextArea value={draft.aiChanged} onChange={(v) => onChange('aiChanged', v)} placeholder="我最後保留、刪掉或修改了什麼？為什麼？" />
          </div>
        </div>
        <button
          disabled={saving}
          onClick={onSave}
          className="w-full rounded-xl bg-[#12776E] py-3 text-[15px] font-bold text-white disabled:bg-[#B8CFCC]"
        >
          {saving ? '儲存中…' : '儲存 SMART 作業'}
        </button>
        {savedAt && <SavedText savedAt={savedAt} />}
      </div>
    </section>
  )
}

function SavedText({ savedAt }: { savedAt: string }) {
  return (
    <p className="mt-2 text-center text-[12.5px] text-[#4A6461]">
      已儲存：{new Date(savedAt).toLocaleString('zh-TW', { hour12: false })}
    </p>
  )
}

function SaveNote({ isPreview }: { isPreview: boolean }) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-dashed border-[#C7E2DC] bg-[#F7FCFB] px-4 py-3 text-[13px] leading-relaxed text-[#4A6461]">
      {isPreview
        ? '預覽模式只暫存在這台裝置，不會寫入資料庫。'
        : '按下儲存後，SMART 目標和 WSQ 反思會交到老師的資料庫，之後可放進學期 PDF。'}
    </section>
  )
}

function HighRiskGoal({ teacherName, risk }: { teacherName: string | null; risk: 2 | 3 }) {
  return (
    <>
      <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
        <h2 className="text-lg font-bold">先照顧現在的自己</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
          這一頁先不安排 SMART 生活目標。請先看完下面的關懷訊息，並讓老師知道你需要一起討論。
        </p>
      </section>
      <RiskCare level={risk} teacherName={teacherName} />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-[#0B4A44]">{label}</span>
      {children}
    </label>
  )
}

function TextArea({ value, onChange, placeholder, disabled = false }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={3}
      className="w-full resize-none rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-[#12776E] disabled:bg-slate-50 disabled:text-slate-400"
    />
  )
}

function SmallInput({ value, onChange, placeholder }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] outline-none focus:border-[#12776E]"
    />
  )
}
