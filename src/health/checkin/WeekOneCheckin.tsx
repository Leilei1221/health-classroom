import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import type {
  HealthCheckin, HealthCheckinStatus, HealthCheckinWeek, HealthGoal, StudentProfile,
} from '../../lib/types'
import HealthHeader, { PreviewBanner } from '../Header'
import Handover from '../Handover'
import {
  getHealthGoal, listHealthCheckinWeeks, listHealthCheckins, saveHealthCheckin,
  saveHealthCheckinWeek, semesterKey,
} from '../api'

const DEFAULT_WEEK_COUNT = 4

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
  sampleCheckin(
    1,
    'done',
    '晚自習前做一輪正念呼吸',
    3,
    '做完後心情比較穩。',
    '有手機計時器截圖，沒有拍到人。',
    ENCOURAGEMENTS[0],
  ),
  sampleCheckin(
    2,
    'partial',
    '睡前把手機放到書桌',
    2,
    '有做但有點分心。',
    '沒有照片，用文字記錄。',
    ENCOURAGEMENTS[5],
  ),
]

const SAMPLE_WEEKS: HealthCheckinWeek[] = Array.from({ length: 4 }, (_, i) => sampleWeek(i + 1))

export default function WeekOneCheckin({ preview }: { preview?: StudentProfile }) {
  const { student: signedIn } = useAuth()
  const isPreview = preview !== undefined
  const student = preview ?? signedIn
  const semester = student ? semesterKey(student) : ''

  const [goal, setGoal] = useState<HealthGoal | null>(null)
  const [checkins, setCheckins] = useState<HealthCheckin[]>([])
  const [weeks, setWeeks] = useState<HealthCheckinWeek[]>([])
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedDay, setSelectedDay] = useState(1)
  const [weekStartDate, setWeekStartDate] = useState('')
  const [status, setStatus] = useState<HealthCheckinStatus>('done')
  const [actionDone, setActionDone] = useState('')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [message, setMessage] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student) return
    if (isPreview) {
      setGoal(SAMPLE_GOAL)
      setCheckins(SAMPLE_CHECKINS.filter((row) => row.week_no === selectedWeek))
      setWeeks((rows) => rows.length > 0 ? rows : SAMPLE_WEEKS)
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
          const [rows, weekRows] = await Promise.all([
            listHealthCheckins(student.email, semester, selectedWeek),
            listHealthCheckinWeeks(student.email, semester),
          ])
          if (!cancelled) {
            setCheckins(rows)
            setWeeks((current) => mergeDefaultWeeks([...current, ...weekRows]))
          }
        }
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [student, semester, isPreview, selectedWeek])

  const byDay = useMemo(() => new Map(checkins.map((row) => [row.day_no, row])), [checkins])
  const current = byDay.get(selectedDay)
  const doneCount = checkins.filter((row) => row.status === 'done').length
  const partialCount = checkins.filter((row) => row.status === 'partial').length
  const activeWeek = weeks.find((week) => week.week_no === selectedWeek)

  useEffect(() => {
    const row = byDay.get(selectedDay)
    setStatus(row?.status ?? 'done')
    setActionDone(row?.action_done ?? '')
    setMinutes(row?.minutes?.toString() ?? '')
    setNote(row?.note ?? '')
    setEvidenceNote(row?.evidence_note ?? '')
    setMessage(row?.encouragement ?? '')
    setSavedAt(row?.updated_at ?? null)
  }, [selectedDay, byDay])

  useEffect(() => {
    setWeekStartDate(activeWeek?.week_start_date ?? '')
  }, [activeWeek])

  if (!student) return null
  if (loading) return <div className="p-10 text-center text-sm text-slate-500">載入中…</div>

  const save = async () => {
    if (!goal) return
    const encouragement = pickEncouragement(selectedDay, status, actionDone, note)
    const row = {
      goal_id: goal.id,
      student_email: student.email,
      semester,
      week_no: selectedWeek,
      day_no: selectedDay,
      check_date: dateForDay(weekStartDate, selectedDay) ?? todayIsoDate(),
      status,
      action_done: actionDone.trim() || null,
      minutes: minutes.trim() ? Number(minutes) : null,
      note: note.trim() || null,
      evidence_note: evidenceNote.trim() || null,
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

  const saveWeekStart = async () => {
    if (!goal) return
    if (isPreview) {
      const saved = previewWeek(goal, student.email, semester, selectedWeek, weekStartDate || null)
      setWeeks((rows) => upsertWeek(rows, saved))
      return
    }
    setSaving(true); setError('')
    try {
      const saved = await saveHealthCheckinWeek({
        goal_id: goal.id,
        student_email: student.email,
        semester,
        week_no: selectedWeek,
        week_start_date: weekStartDate || null,
      })
      setWeeks((rows) => upsertWeek(rows, saved))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const addWeek = async () => {
    const next = Math.max(DEFAULT_WEEK_COUNT, ...weeks.map((week) => week.week_no)) + 1
    if (!goal || next > 20) return
    setSaving(true); setError('')
    try {
      const saved = isPreview
        ? previewWeek(goal, student.email, semester, next, null)
        : await saveHealthCheckinWeek({
            goal_id: goal.id,
            student_email: student.email,
            semester,
            week_no: next,
            week_start_date: null,
          })
      setWeeks((rows) => upsertWeek(rows, saved))
      setSelectedWeek(next)
      setSelectedDay(1)
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
            這是健康行動打卡預覽。預覽不會寫入資料庫。
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
            <WeekSelector
              weeks={weeks}
              selectedWeek={selectedWeek}
              onPick={(week) => { setSelectedWeek(week); setSelectedDay(1) }}
              onAdd={addWeek}
            />
            <WeekStartEditor
              weekNo={selectedWeek}
              value={weekStartDate}
              saving={saving}
              onChange={setWeekStartDate}
              onSave={() => void saveWeekStart()}
            />
            <WeekGrid
              selectedDay={selectedDay}
              byDay={byDay}
              weekStartDate={weekStartDate}
              onPick={setSelectedDay}
            />
            <CheckinEditor
              day={selectedDay}
              status={status}
              actionDone={actionDone}
              minutes={minutes}
              note={note}
              evidenceNote={evidenceNote}
              saving={saving}
              onStatus={setStatus}
              onActionDone={setActionDone}
              onMinutes={setMinutes}
              onNote={setNote}
              onEvidenceNote={setEvidenceNote}
              onSave={() => void save()}
            />
            {message && <Encouragement message={message} savedAt={savedAt} />}
            {(current?.action_done || current?.note || current?.evidence_note) && (
              <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-3">
                <h3 className="text-[14px] font-bold">這一天的紀錄</h3>
                {current.action_done && (
                  <p className="mt-1.5 text-[14px] leading-relaxed">
                    <b>行動：</b>{current.action_done}
                  </p>
                )}
                {current.note && (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#4A6461]">
                    <b>感受：</b>{current.note}
                  </p>
                )}
                {current.evidence_note && (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#4A6461]">
                    <b>佐證：</b>{current.evidence_note}
                  </p>
                )}
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
      <p className="text-[12px] font-bold tracking-widest text-[#12776E]">健康行動打卡</p>
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

function WeekSelector({ weeks, selectedWeek, onPick, onAdd }: {
  weeks: HealthCheckinWeek[]
  selectedWeek: number
  onPick: (week: number) => void
  onAdd: () => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">選擇週次</h3>
        <p className="mt-0.5 text-[13px] text-[#4A6461]">預設四週；如果想繼續追蹤，可以自己增加週次。</p>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3">
        {weeks.map((week) => (
          <button
            key={week.week_no}
            onClick={() => onPick(week.week_no)}
            className={`min-w-[76px] rounded-xl border px-3 py-2 text-sm font-bold ${
              selectedWeek === week.week_no
                ? 'border-[#12776E] bg-[#E9F5F2] text-[#0B4A44]'
                : 'border-[#C7E2DC] bg-white text-[#4A6461]'
            }`}
          >
            第 {week.week_no} 週
          </button>
        ))}
        <button
          onClick={onAdd}
          className="min-w-[88px] rounded-xl border border-dashed border-[#12776E] bg-white px-3 py-2 text-sm font-bold text-[#12776E]"
        >
          新增週次
        </button>
      </div>
    </section>
  )
}

function WeekStartEditor({ weekNo, value, saving, onChange, onSave }: {
  weekNo: number
  value: string
  saving: boolean
  onChange: (value: string) => void
  onSave: () => void
}) {
  return (
    <section className="mx-3 my-3.5 rounded-2xl border border-[#C7E2DC] bg-white px-4 py-4">
      <h3 className="text-base font-bold">第 {weekNo} 週開始日期</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[#4A6461]">
        選這一週從哪一天開始，下面七格會自動排出日期。
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] outline-none focus:border-[#12776E]"
        />
        <button
          disabled={saving}
          onClick={onSave}
          className="shrink-0 rounded-xl bg-[#12776E] px-4 py-2.5 text-[14px] font-bold text-white disabled:bg-[#B8CFCC]"
        >
          儲存
        </button>
      </div>
    </section>
  )
}

function WeekGrid({ selectedDay, byDay, weekStartDate, onPick }: {
  selectedDay: number
  byDay: Map<number, HealthCheckin>
  weekStartDate: string
  onPick: (day: number) => void
}) {
  return (
    <section className="mx-3 my-3.5 overflow-hidden rounded-2xl border border-[#C7E2DC] bg-white">
      <div className="border-b border-[#C7E2DC] bg-[#F7FCFB] px-4 pb-3 pt-3.5">
        <h3 className="text-base font-bold">本週 7 天</h3>
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
              <span className="block text-[10.5px] text-[#4A6461]">
                {dateLabel(weekStartDate, day)}
              </span>
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

function CheckinEditor({
  day, status, actionDone, minutes, note, evidenceNote, saving,
  onStatus, onActionDone, onMinutes, onNote, onEvidenceNote, onSave,
}: {
  day: number
  status: HealthCheckinStatus
  actionDone: string
  minutes: string
  note: string
  evidenceNote: string
  saving: boolean
  onStatus: (status: HealthCheckinStatus) => void
  onActionDone: (value: string) => void
  onMinutes: (value: string) => void
  onNote: (value: string) => void
  onEvidenceNote: (value: string) => void
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
          <span className="mb-1.5 block text-[13px] font-bold text-[#0B4A44]">今天做了什麼行動？</span>
          <textarea
            rows={3}
            value={actionDone}
            onChange={(e) => onActionDone(e.target.value)}
            placeholder="例：晚自習前做一輪正念呼吸、午餐後到操場走 10 分鐘、睡前把手機放到書桌。"
            className="w-full resize-none rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-[#12776E]"
          />
        </label>
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
          <span className="mb-1.5 block text-[13px] font-bold text-[#0B4A44]">今天的感受或發現</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="例：剛開始有點懶，但做完比較清醒；也發現如果有人提醒我會比較容易開始。"
            className="w-full resize-none rounded-xl border border-[#C7E2DC] px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-[#12776E]"
          />
        </label>
        <div className="rounded-xl border border-[#C7E2DC] bg-[#F7FCFB] px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-[14px] font-bold">照片或截圖佐證</h4>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#4A6461]">
                現在先用文字記錄，之後才會開放上傳檔案。
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11.5px] font-bold text-[#12776E]">
              選填
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-[#4A6461]">
            <li>可以寫：有運動手錶截圖、睡眠紀錄截圖、操場照片、餐點照片。</li>
            <li>不要拍到同學清楚臉部、學號、班級名牌或定位資訊。</li>
            <li>沒有照片也可以，只要用文字把今天的行動寫清楚。</li>
          </ul>
          <textarea
            rows={3}
            value={evidenceNote}
            onChange={(e) => onEvidenceNote(e.target.value)}
            placeholder="例：有運動 app 截圖；有拍操場照片但沒有拍到人；今天沒有照片，用文字記錄。"
            className="mt-3 w-full resize-none rounded-xl border border-[#C7E2DC] bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-[#12776E]"
          />
        </div>
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
        打卡會連到你的 SMART 目標。先完成目標設定，再回來記錄每週行動。
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

function pickEncouragement(day: number, status: HealthCheckinStatus, actionDone: string, note: string): string {
  const seed = day + status.length + actionDone.length + note.length
  return ENCOURAGEMENTS[seed % ENCOURAGEMENTS.length]
}

function todayIsoDate(): string {
  return formatLocalDate(new Date())
}

function dateForDay(weekStartDate: string, day: number): string | null {
  if (!weekStartDate) return null
  const date = parseLocalDate(weekStartDate)
  if (!date) return null
  date.setDate(date.getDate() + day - 1)
  return formatLocalDate(date)
}

function dateLabel(weekStartDate: string, day: number): string {
  const value = dateForDay(weekStartDate, day)
  if (!value) return '未定'
  const [, month, date] = value.split('-')
  return `${Number(month)}/${Number(date)}`
}

function parseLocalDate(value: string): Date | null {
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sampleWeek(weekNo: number): HealthCheckinWeek {
  const start = dateForDay('2026-09-21', ((weekNo - 1) * 7) + 1)
  return previewWeek(SAMPLE_GOAL, SAMPLE_GOAL.student_email, SAMPLE_GOAL.semester, weekNo, start)
}

function mergeDefaultWeeks(rows: HealthCheckinWeek[]): HealthCheckinWeek[] {
  const byWeek = new Map<number, HealthCheckinWeek>()
  for (let weekNo = 1; weekNo <= DEFAULT_WEEK_COUNT; weekNo += 1) {
    byWeek.set(weekNo, previewWeek(SAMPLE_GOAL, '', '', weekNo, null))
  }
  rows.forEach((row) => byWeek.set(row.week_no, row))
  return [...byWeek.values()].sort((a, b) => a.week_no - b.week_no)
}

function upsertWeek(rows: HealthCheckinWeek[], saved: HealthCheckinWeek): HealthCheckinWeek[] {
  return [...rows.filter((row) => row.week_no !== saved.week_no), saved]
    .sort((a, b) => a.week_no - b.week_no)
}

function previewWeek(
  goal: HealthGoal,
  email: string,
  semester: string,
  weekNo: number,
  weekStartDate: string | null,
): HealthCheckinWeek {
  const now = new Date().toISOString()
  return {
    id: `preview-week-${weekNo}`,
    goal_id: goal.id,
    student_email: email,
    semester,
    week_no: weekNo,
    week_start_date: weekStartDate,
    created_at: now,
    updated_at: now,
  }
}

function sampleCheckin(
  day: number,
  status: HealthCheckinStatus,
  actionDone: string,
  minutes: number,
  note: string,
  evidenceNote: string,
  encouragement: string,
): HealthCheckin {
  return {
    id: `preview-${day}`,
    goal_id: SAMPLE_GOAL.id,
    student_email: SAMPLE_GOAL.student_email,
    semester: SAMPLE_GOAL.semester,
    week_no: 1,
    day_no: day,
    check_date: todayIsoDate(),
    status,
    action_done: actionDone,
    minutes,
    note,
    evidence_note: evidenceNote,
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
  action_done: string | null
  minutes: number | null
  note: string | null
  evidence_note: string | null
  encouragement: string
}): HealthCheckin {
  return {
    ...row,
    id: `preview-${row.day_no}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
