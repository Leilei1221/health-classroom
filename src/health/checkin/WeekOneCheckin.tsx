import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import type { HealthCheckin, HealthCheckinStatus, HealthGoal, StudentProfile } from '../../lib/types'
import HealthHeader, { PreviewBanner } from '../Header'
import Handover from '../Handover'
import { getHealthGoal, listHealthCheckins, saveHealthCheckin, semesterKey } from '../api'

const WEEK_NO = 1

const ENCOURAGEMENTS = [
  '恭喜你又完成一次！',
  '你真的很棒，很努力在做！',
  '有意識到自己的行為並願意加以改善，是一件很棒的事！',
  '今天有把目標放在心上，這就是進步。',
  '小小一步也算數，你正在累積自己的改變。',
  '做得到一部分也很好，願意開始就很重要。',
  '謝謝你沒有放棄照顧自己。',
  '這次紀錄會幫助你看見自己的努力。',
]

const STATUS_TEXT: Record<HealthCheckinStatus, string> = {
  done: '完成',
  partial: '做到一部分',
  rest: '今天先休息',
}

const STATUS_STYLE: Record<HealthCheckinStatus, string> = {
  done: 'border-[#12776E] bg-[#E9F5F2] text-[#0B4A44]',
  partial: 'border-[#E2C9A6] bg-[#FDF3E3] text-[#8A5310]',
  rest: 'border-[#C7E2DC] bg-white text-[#4A6461]',
}

const SAMPLE_GOAL: HealthGoal = {
  id: 'preview-goal',
  student_email: 'spreview@hlhs.hlc.edu.tw',
  semester: '115-1',
  goal_no: 1,
  selected_options: [{ id: 'breathing', label: '深呼吸紓壓', domain: '壓力' }],
  direction: '壓力調節',
  s_action: '讀書前做 3 分鐘正念呼吸，吸氣、停留、吐氣都慢慢來。',
  m_method: '記錄每天練習的次數與當下壓力感受。',
  frequency: '每週 3 天',
  target_per_week: 3,
  confidence: 7,
  why: '希望讀書前比較安定，晚上也比較好睡。',
  people: '同學可以提醒我晚自習開始前先做一次。',
  place: '教室座位或房間書桌前。',
  resources: '呼吸引導、鬧鐘、週表。',
  reward: '完成三天後週末看一集喜歡的影集。',
  week1: '先做小版本：每天 3 分鐘。',
  week2: null,
  week3: null,
  week4: null,
  ai_prompt: null,
  ai_ask: null,
  ai_useful: null,
  ai_changed: null,
  wsq_watch: null,
  wsq_summary: null,
  wsq_question: null,
  confirmed: true,
  status: 'active',
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const SAMPLE_CHECKINS: HealthCheckin[] = [
  sampleCheckin(1, 'done', 3, '晚自習前做了一輪，心情比較穩。', ENCOURAGEMENTS[0]),
  sampleCheckin(2, 'partial', 2, '有做但有點分心。', ENCOURAGEMENTS[5]),
]

export default function WeekOneCheckin({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [goal, setGoal] = useState<HealthGoal | null>(null)
  const [checkins, setCheckins] = useState<HealthCheckin[]>([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [status, setStatus] = useState<HealthCheckinStatus>('done')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student) return
    if (isPreview) {
      setGoal(SAMPLE_GOAL)
      setCheckins(SAMPLE_CHECKINS)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true); setError('')
    getHealthGoal(student.email, semester, 1)
      .then(async (g) => {
        if (cancelled) return
        setGoal(g)
        if (g) {
          const rows = await listHealthCheckins(student.email, semester, WEEK_NO)
          if (!cancelled) setCheckins(rows)
        }
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [student, semester, isPreview])

  const byDay = useMemo(() => new Map(checkins.map((row) => [row.day_no, row])), [checkins])
  const current = byDay.get(selectedDay)
  const doneCount = checkins.filter((row) => row.status === 'done').length
  const partialCount = checkins.filter((row) => row.status === 'partial').length

  useEffect(() => {
    const row = byDay.get(selectedDay)
    setStatus(row?.status ?? 'done')
    setMinutes(row?.minutes?.toString() ?? '')
    setNote(row?.note ?? '')
    setMessage(row?.encouragement ?? '')
    setSavedAt(row?.updated_at ?? null)
  }, [selectedDay, byDay])

  if (!student) return null
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>

  const save = async () => {
    if (!goal) return
    const encouragement = pickEncouragement(selectedDay, status, note)
    const row = {
      goal_id: goal.id,
      student_email: student.email,
      semester,
      week_no: WEEK_NO,
      day_no: selectedDay,
      check_date: todayIsoDate(),
      status,
      minutes: minutes.trim() ? Number(minutes) : null,
      note: note.trim() || null,
      encouragement,
    }
    setSaving(true); setError('')
    try {
      const saved = isPreview
        ? previewSaved(row)
        : await saveHealthCheckin(row)
      setCheckins((rows) => {
        const rest = rows.filter((item) => item.day_no !== selectedDay)
        return [...rest, saved].sort((a, b) => a.day_no - b.day_no)
      })
      setMessage(saved.encouragement ?? encouragement)
      setSavedAt(saved.updated_at)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#E9F5F2] text-[#0E2E2B]">
      <div className="mx-auto max-w-[520px] pb-12">
        <HealthHeader student={student} isPreview={isPreview} tab="checkin" />

        {isPreview && (
          <PreviewBanner>
            這是第一週打卡預覽。預覽不會寫入資料庫。
          </PreviewBanner>
        )}
        {error && (
          <div className="mx-3 mt-3 rounded-lg bg-[#FBEDEC] px-4 py-3 text-sm text-[#A8403C]">
            {error}
          </div>
        )}

        {!goal ? (
          <MissingGoal />
        ) : (
          <>
            <GoalSummary goal={goal} doneCount={doneCount} partialCount={partialCount} />
            <WeekGrid selectedDay={selectedDay} byDay={byDay} onPick={setSelectedDay} />
            <CheckinEditor
              day={selectedDay}
              status={status}
              minutes={minutes}
              note={note}
              saving={saving}
              onStatus={setStatus}
              onMinutes={setMinutes}
              onNote={setNote}
              onSave={() => void save()}
            />
            {message && <Encouragement message={message} savedAt={savedAt} />}
            {current?.note && (
              <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-3">
                <h3 className="text-[14px] font-bold">這一天的紀錄</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#4A6461]">{current.note}</p>
              </section>
            )}
          </>
        )}

        {!isPreview && <Handover />}
      </div>
    </div>
  )
}

function GoalSummary({ goal, doneCount, partialCount }: {
  goal: HealthGoal
  doneCount: number
  partialCount: number
}) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
      <p className="text-[12px] font-bold tracking-widest text-[#12776E]">第一週打卡</p>
      <h2 className="mt-1 text-xl font-bold">今天有靠近目標一點點嗎？</h2>
      <div className="mt-3 rounded-xl bg-[#F7FCFB] px-3 py-3">
        <p className="text-[13px] font-bold text-[#12776E]">{goal.direction}</p>
        <p className="mt-1 text-[14px] leading-relaxed">{goal.s_action}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#4A6461]">
          目標頻率：{goal.frequency || `每週 ${goal.target_per_week} 天`}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-[#E9F5F2] px-3 py-2">
          <b className="text-lg tabular-nums">{doneCount}</b>
          <p className="text-[12.5px] text-[#4A6461]">完成</p>
        </div>
        <div className="rounded-xl bg-[#FDF3E3] px-3 py-2">
          <b className="text-lg tabular-nums">{partialCount}</b>
          <p className="text-[12.5px] text-[#8A5310]">有做到一部分</p>
        </div>
      </div>
    </section>
  )
}

function WeekGrid({ selectedDay, byDay, onPick }: {
  selectedDay: number
  byDay: Map<number, HealthCheckin>
  onPick: (day: number) => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">第 1 週</h3>
        <p className="mt-0.5 text-[13px] text-[#4A6461]">點一天來打卡。可以補前面的紀錄，不需要一次填完。</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 p-3">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
          const row = byDay.get(day)
          const on = selectedDay === day
          return (
            <button
              key={day}
              onClick={() => onPick(day)}
              className={`aspect-square rounded-xl border text-center transition ${
                on ? 'border-[#12776E] bg-[#E9F5F2]' : 'border-[#C7E2DC] bg-white'
              }`}
            >
              <span className="block text-[11px] text-[#4A6461]">第</span>
              <b className="text-lg tabular-nums">{day}</b>
              <span className="block text-[11px] text-[#4A6461]">天</span>
              <span className="mt-0.5 block text-[15px] leading-none">
                {row ? statusMark(row.status) : '□'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CheckinEditor({ day, status, minutes, note, saving, onStatus, onMinutes, onNote, onSave }: {
  day: number
  status: HealthCheckinStatus
  minutes: string
  note: string
  saving: boolean
  onStatus: (status: HealthCheckinStatus) => void
  onMinutes: (value: string) => void
  onNote: (value: string) => void
  onSave: () => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">第 {day} 天打卡</h3>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold text-[#0B4A44]">今天的狀態</label>
          <div className="grid grid-cols-3 gap-2">
            {(['done', 'partial', 'rest'] as const).map((item) => (
              <button
                key={item}
                onClick={() => onStatus(item)}
                className={`rounded-xl border px-2 py-2.5 text-[13px] font-bold ${
                  status === item ? STATUS_STYLE[item] : 'border-[#C7E2DC] bg-white text-[#4A6461]'
                }`}
              >
                {STATUS_TEXT[item]}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#0B4A44]">大約花多久？</span>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={minutes}
              onChange={(e) => onMinutes(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              placeholder="例：10"
              className="w-full rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] outline-none focus:border-[#12776E]"
            />
            <span className="shrink-0 text-[13px] text-[#4A6461]">分鐘</span>
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#0B4A44]">一句記錄</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="例：今天下課有去操場走一圈，剛開始有點懶，但走完比較清醒。"
            className="w-full resize-none rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-[#12776E]"
          />
        </label>
        <button
          disabled={saving}
          onClick={onSave}
          className="w-full rounded-xl bg-[#12776E] py-3 text-[15px] font-bold text-white disabled:bg-[#B8CFCC]"
        >
          {saving ? '儲存中…' : '儲存今天打卡'}
        </button>
      </div>
    </section>
  )
}

function Encouragement({ message, savedAt }: { message: string; savedAt: string | null }) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#BBDDD6] bg-[#F7FCFB] px-4 py-4 text-center">
      <p className="text-lg font-bold text-[#12776E]">{message}</p>
      {savedAt && (
        <p className="mt-1 text-[12.5px] text-[#4A6461]">
          已儲存：{new Date(savedAt).toLocaleString('zh-TW', { hour12: false })}
        </p>
      )}
    </section>
  )
}

function MissingGoal() {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-5">
      <h2 className="text-lg font-bold">還沒有 SMART 目標</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4A6461]">
        打卡會連到你的 SMART 目標。先完成目標設定，再回來做第一週紀錄。
      </p>
      <Link
        to="/health/goal"
        className="mt-4 block rounded-xl bg-[#12776E] py-3 text-center text-[15px] font-bold text-white"
      >
        前往 SMART 目標
      </Link>
    </section>
  )
}

function statusMark(status: HealthCheckinStatus): string {
  return status === 'done' ? '✓' : status === 'partial' ? '◐' : '·'
}

function pickEncouragement(day: number, status: HealthCheckinStatus, note: string): string {
  const seed = day + status.length + note.length
  return ENCOURAGEMENTS[seed % ENCOURAGEMENTS.length]
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function sampleCheckin(
  day: number,
  status: HealthCheckinStatus,
  minutes: number,
  note: string,
  encouragement: string,
): HealthCheckin {
  return {
    id: `preview-${day}`,
    goal_id: SAMPLE_GOAL.id,
    student_email: SAMPLE_GOAL.student_email,
    semester: SAMPLE_GOAL.semester,
    week_no: WEEK_NO,
    day_no: day,
    check_date: todayIsoDate(),
    status,
    minutes,
    note,
    encouragement,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function previewSaved(row: {
  goal_id: string
  student_email: string
  semester: string
  week_no: number
  day_no: number
  check_date: string
  status: HealthCheckinStatus
  minutes: number | null
  note: string | null
  encouragement: string
}): HealthCheckin {
  return {
    ...row,
    id: `preview-${row.day_no}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
