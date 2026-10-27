import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../auth'
import { friendlyError } from '../../lib/errors'
import type { HealthGoalReviewStatus } from '../../lib/types'
import {
  listGoalReviewStudents, listHealthClasses, saveHealthGoalReview,
  type GoalReviewStudent, type HealthClass,
} from '../api'
import ClassButton from './ClassButton'

const REVIEW_LABEL: Record<HealthGoalReviewStatus, string> = {
  reviewed: '已看過',
  revise: '請調整',
  approved: '完成',
}

const CHECKIN_LABEL = {
  done: '完成',
  partial: '做到一部分',
  rest: '休息',
} as const

export default function GoalReview() {
  const { teacher } = useAuth()
  const [classes, setClasses] = useState<HealthClass[] | null>(null)
  const [rows, setRows] = useState<GoalReviewStudent[] | null>(null)
  const [classId, setClassId] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [weekNo, setWeekNo] = useState(1)
  const [reviewStatus, setReviewStatus] = useState<HealthGoalReviewStatus>('reviewed')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listHealthClasses()
      .then(async (items) => {
        if (cancelled) return
        setClasses(items)
        setClassId((current) => current ?? items[0]?.row.id ?? null)
        const students = await listGoalReviewStudents(items)
        if (!cancelled) setRows(students)
      })
      .catch((e) => { if (!cancelled) setError(friendlyError(e)) })
    return () => { cancelled = true }
  }, [])

  const mine = useMemo(
    () => (rows ?? []).filter((row) => row.class_id === classId),
    [rows, classId],
  )

  useEffect(() => {
    setStudentId((current) => mine.some((row) => row.student_id === current)
      ? current
      : mine[0]?.student_id ?? null)
  }, [mine])

  const selected = mine.find((row) => row.student_id === studentId) ?? null

  useEffect(() => {
    setReviewStatus(selected?.review?.status ?? 'reviewed')
    setFeedback(selected?.review?.feedback ?? '')
    setWeekNo(1)
    setSaved(false)
  }, [selected?.student_id, selected?.review])

  const goalCount = mine.filter((row) => row.goal?.confirmed).length
  const reviewedCount = mine.filter((row) => row.review).length

  const saveReview = async () => {
    if (!selected?.goal) return
    setSaving(true); setError(''); setSaved(false)
    try {
      const review = await saveHealthGoalReview({
        goal_id: selected.goal.id,
        student_email: selected.account,
        semester: selected.goal.semester,
        status: reviewStatus,
        feedback: feedback.trim() || null,
      })
      setRows((current) => current?.map((row) => (
        row.student_id === selected.student_id ? { ...row, review } : row
      )) ?? null)
      setSaved(true)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout
      title="SMART 與行動批改"
      subtitle={`${teacher?.display_name ?? ''}・教師私用，請勿投影`}
      actions={<Link to="/health/progress" className="cute-chip hidden !min-h-[40px] bg-cute-blue text-[13px] sm:inline-flex">班級進度</Link>}
    >
        {error && <Notice tone="error">{error}</Notice>}
        {classes === null || rows === null ? (
          <Notice>載入中…</Notice>
        ) : classes.length === 0 ? (
          <Notice>目前沒有可查看的健康管理班級。</Notice>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {classes.map((item) => (
                <ClassButton key={item.row.id} cls={item} current={classId} onPick={setClassId} />
              ))}
            </div>

            <section className="mb-4 grid grid-cols-3 gap-2 cute-card rounded-3xl p-3 text-center">
              <Stat value={mine.length} label="班級人數" />
              <Stat value={goalCount} label="已交目標" />
              <Stat value={reviewedCount} label="已批改" />
            </section>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <section>
                <h2 className="mb-2 text-sm font-bold">選擇學生</h2>
                <div className="max-h-[70vh] divide-y divide-cute-ink/15 overflow-y-auto cute-card rounded-3xl">
                  {mine.map((row) => (
                    <button
                      key={row.student_id}
                      onClick={() => setStudentId(row.student_id)}
                      className={`flex w-full items-center gap-2 px-3 py-3 text-left ${
                        studentId === row.student_id ? 'bg-cute-butter' : 'bg-white hover:bg-white'
                      }`}
                    >
                      <span className="w-10 text-sm tabular-nums text-cute-mute">{row.seat_no ?? '—'} 號</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                      <StudentStatus row={row} />
                    </button>
                  ))}
                </div>
              </section>

              {!selected ? (
                <Notice>請先選擇一位學生。</Notice>
              ) : !selected.goal ? (
                <Notice>{selected.seat_no ?? '—'} 號 {selected.name} 尚未建立 SMART 目標。</Notice>
              ) : (
                <div className="space-y-4">
                  <GoalPanel row={selected} />
                  <CheckinPanel row={selected} weekNo={weekNo} onWeek={setWeekNo} />
                  <ReviewEditor
                    status={reviewStatus}
                    feedback={feedback}
                    saving={saving}
                    saved={saved}
                    onStatus={setReviewStatus}
                    onFeedback={setFeedback}
                    onSave={() => void saveReview()}
                  />
                </div>
              )}
            </div>
          </>
        )}
    </Layout>
  )
}

function StudentStatus({ row }: { row: GoalReviewStudent }) {
  if (!row.goal?.confirmed) return <span className="text-xs font-bold text-cute-mute">未交</span>
  if (!row.review) return <span className="text-xs font-bold text-[#7A4A08]">待批改</span>
  return <span className="text-xs font-bold text-cute-ink">{REVIEW_LABEL[row.review.status]}</span>
}

function GoalPanel({ row }: { row: GoalReviewStudent }) {
  const goal = row.goal!
  const weeks = [goal.week1, goal.week2, goal.week3, goal.week4]
  return (
    <section className="overflow-hidden cute-card rounded-3xl">
      <div className="border-b-2 border-cute-ink/15 bg-cute-butter px-4 py-3">
        <p className="text-xs font-bold text-cute-ink">{row.seat_no ?? '—'} 號・{row.name}</p>
        <h2 className="mt-1 text-lg font-bold">{goal.direction}</h2>
      </div>
      <div className="space-y-4 p-4 text-sm leading-relaxed">
        <Info label="具體行動" value={goal.s_action} />
        <Info label="測量方式" value={goal.m_method} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="頻率" value={goal.frequency} />
          <Info label="信心分數" value={`${goal.confidence}／10`} />
        </div>
        {goal.why && <Info label="選擇原因" value={goal.why} />}
        <div>
          <p className="text-xs font-bold text-cute-mute">四週計畫</p>
          <div className="mt-1 divide-y divide-cute-ink/15 border-y border-cute-ink/15">
            {weeks.map((week, index) => (
              <div key={index} className="grid grid-cols-[56px_1fr] gap-2 py-2">
                <b className="text-cute-ink">第 {index + 1} 週</b>
                <span>{week || '未填寫'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CheckinPanel({ row, weekNo, onWeek }: {
  row: GoalReviewStudent
  weekNo: number
  onWeek: (week: number) => void
}) {
  const weekNumbers = [...new Set([
    1, 2, 3, 4,
    ...row.weeks.map((week) => week.week_no),
    ...row.checkins.map((checkin) => checkin.week_no),
  ])].sort((a, b) => a - b)
  const week = row.weeks.find((item) => item.week_no === weekNo)
  const checkins = row.checkins.filter((item) => item.week_no === weekNo)
  return (
    <section className="overflow-hidden cute-card rounded-3xl">
      <div className="border-b-2 border-cute-ink/15 bg-cute-butter px-4 py-3">
        <h2 className="text-base font-bold">行動紀錄</h2>
        <p className="mt-0.5 text-xs text-cute-mute">只顯示學生已儲存的文字紀錄。</p>
      </div>
      <div className="p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weekNumbers.map((number) => (
            <button
              key={number}
              onClick={() => onWeek(number)}
              className={`cute-chip !min-h-[40px] min-w-[70px] shrink-0 ${weekNo === number ? 'bg-cute-yellow' : 'bg-white'}`}
            >
              第 {number} 週
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-cute-mute">
          開始日期：{week?.week_start_date ?? '尚未設定'}・已記錄 {checkins.length} 天
        </p>
        {checkins.length === 0 ? (
          <p className="mt-4 rounded-lg bg-white px-3 py-4 text-center text-sm text-cute-mute">本週尚無打卡紀錄。</p>
        ) : (
          <div className="mt-3 divide-y divide-cute-ink/15 border-y border-cute-ink/15">
            {checkins.map((item) => (
              <div key={item.id} className="py-3 text-sm">
                <div className="flex items-center gap-2">
                  <b>第 {item.day_no} 天</b>
                  <span className="text-xs text-cute-mute">{item.check_date}</span>
                  <span className="ml-auto rounded-full bg-cute-butter px-2 py-1 text-xs font-bold text-cute-ink">
                    {CHECKIN_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1.5"><b>行動：</b>{item.action_done || '未填寫'}</p>
                {item.minutes !== null && <p className="mt-1 text-cute-mute"><b>時間：</b>{item.minutes} 分鐘</p>}
                {item.note && <p className="mt-1 text-cute-mute"><b>感受：</b>{item.note}</p>}
                {item.evidence_note && <p className="mt-1 text-cute-mute"><b>佐證：</b>{item.evidence_note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ReviewEditor({ status, feedback, saving, saved, onStatus, onFeedback, onSave }: {
  status: HealthGoalReviewStatus
  feedback: string
  saving: boolean
  saved: boolean
  onStatus: (status: HealthGoalReviewStatus) => void
  onFeedback: (value: string) => void
  onSave: () => void
}) {
  return (
    <section className="cute-card rounded-3xl p-4">
      <h2 className="text-base font-bold">批改與建議</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(Object.keys(REVIEW_LABEL) as HealthGoalReviewStatus[]).map((item) => (
          <button
            key={item}
            onClick={() => onStatus(item)}
            className={`cute-chip ${status === item ? 'bg-cute-yellow' : 'bg-white'}`}
          >
            {REVIEW_LABEL[item]}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-bold">給學生的建議</span>
        <textarea
          rows={5}
          value={feedback}
          onChange={(event) => onFeedback(event.target.value)}
          placeholder="例：目標很具體。建議把第三週的增加幅度再縮小一點，比較容易維持。"
          className="cute-field resize-none leading-relaxed"
        />
      </label>
      <button
        disabled={saving}
        onClick={onSave}
        className="cute-btn mt-3 w-full disabled:opacity-50"
      >
        {saving ? '儲存中…' : '儲存批改'}
      </button>
      {saved && <p className="mt-2 text-center text-xs font-bold text-cute-ink">批改已儲存，學生端會看到這則回饋。</p>}
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-cute-mute">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b className="text-xl tabular-nums">{value}</b>
      <p className="text-xs text-cute-mute">{label}</p>
    </div>
  )
}

function Notice({ tone, children }: { tone?: 'error'; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-[#E7C4C2] bg-[#FBEDEC] text-[#9A3834]'
        : 'border-cute-ink/20 bg-white text-cute-mute'
    }`}>
      {children}
    </div>
  )
}
