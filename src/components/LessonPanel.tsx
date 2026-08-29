import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, ErrorBox, Field, Spinner, inputClass } from './ui'
import {
  addPerformanceRecord, createLesson, deleteLesson, deletePerformanceRecord,
  listAttendance, listAttendanceStatuses, listLessons, listPerformanceItems,
  listPerformanceRecords, listStudents, saveAttendance,
} from '../lib/api'
import { friendlyError } from '../lib/errors'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus, Lesson,
  PerformanceItem, PerformanceRecord, Student,
} from '../lib/types'

const today = () => new Date().toISOString().slice(0, 10)

export default function LessonPanel({ classId, teacherId }: {
  classId: string
  teacherId: string
}) {
  const [students, setStudents] = useState<Student[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [statuses, setStatuses] = useState<AttendanceStatus[]>([])
  const [items, setItems] = useState<PerformanceItem[]>([])
  const [current, setCurrent] = useState<Lesson | null>(null)
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow>>({})
  const [records, setRecords] = useState<PerformanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newLesson, setNewLesson] = useState({ lesson_date: today(), period: 1, topic: '' })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listStudents(classId), listLessons(classId),
      listAttendanceStatuses(), listPerformanceItems(),
    ])
      .then(([st, ls, sts, its]) => {
        setStudents(st); setLessons(ls); setStatuses(sts); setItems(its)
        setCurrent(ls[0] ?? null)
      })
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }, [classId])

  const loadLesson = useCallback(async (lesson: Lesson) => {
    try {
      const [att, recs] = await Promise.all([
        listAttendance(lesson.id), listPerformanceRecords(lesson.id),
      ])
      setAttendance(Object.fromEntries(att.map((a) => [a.student_id, a])))
      setRecords(recs)
    } catch (e) { setError(friendlyError(e)) }
  }, [])

  useEffect(() => {
    if (current) void loadLesson(current)
    else { setAttendance({}); setRecords([]) }
  }, [current, loadLesson])

  const addLesson = async () => {
    setError('')
    try {
      const l = await createLesson({ ...newLesson, class_id: classId, created_by: teacherId })
      setLessons([l, ...lessons]); setCurrent(l)
      setNewLesson({ lesson_date: today(), period: 1, topic: '' })
    } catch (e) { setError(friendlyError(e)) }
  }

  const removeLesson = async (l: Lesson) => {
    if (!confirm(`確定刪除 ${l.lesson_date} 第 ${l.period} 節？點名與表現紀錄會一併刪除。`)) return
    try {
      await deleteLesson(l.id)
      const rest = lessons.filter((x) => x.id !== l.id)
      setLessons(rest)
      setCurrent(rest[0] ?? null)
    } catch (e) { setError(friendlyError(e)) }
  }

  /** 點名狀態改變時只更新本地狀態，按「儲存點名」才寫入資料庫 */
  const setStatus = (studentId: string, code: AttendanceCode) => {
    const def = statuses.find((s) => s.code === code)
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? { id: '', lesson_id: current!.id, student_id: studentId, note: '' }),
        status: code,
        points: def?.default_points ?? 0,
      } as AttendanceRow,
    }))
  }

  const persistAttendance = async () => {
    if (!current) return
    setSaving(true); setError('')
    try {
      await saveAttendance(
        students.map((s) => {
          const a = attendance[s.id]
          const code: AttendanceCode = a?.status ?? 'present'
          const def = statuses.find((x) => x.code === code)
          return {
            lesson_id: current.id,
            student_id: s.id,
            status: code,
            points: a?.points ?? def?.default_points ?? 0,
            note: a?.note ?? '',
            recorded_by: teacherId,
          }
        }),
      )
      await loadLesson(current)
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  const addRecord = async (studentId: string, item: PerformanceItem) => {
    if (!current) return
    try {
      await addPerformanceRecord({
        lesson_id: current.id,
        student_id: studentId,
        item_id: item.id,
        label: item.label,
        points: item.default_points,
        reason: '',
        created_by: teacherId,
      })
      setRecords(await listPerformanceRecords(current.id))
    } catch (e) { setError(friendlyError(e)) }
  }

  const removeRecord = async (id: string) => {
    if (!current) return
    try {
      await deletePerformanceRecord(id)
      setRecords(await listPerformanceRecords(current.id))
    } catch (e) { setError(friendlyError(e)) }
  }

  const pointsOf = (studentId: string) =>
    records.filter((r) => r.student_id === studentId).reduce((n, r) => n + Number(r.points), 0)

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <Field label="日期">
          <input type="date" className={inputClass} value={newLesson.lesson_date}
            onChange={(e) => setNewLesson({ ...newLesson, lesson_date: e.target.value })} />
        </Field>
        <Field label="節次">
          <input type="number" min={1} max={12} className={inputClass} value={newLesson.period}
            onChange={(e) => setNewLesson({ ...newLesson, period: +e.target.value })} />
        </Field>
        <Field label="課程主題">
          <input className={inputClass} placeholder="選填" value={newLesson.topic}
            onChange={(e) => setNewLesson({ ...newLesson, topic: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button onClick={addLesson} className="w-full">建立課堂</Button>
        </div>
      </div>

      {lessons.length === 0 ? (
        <Empty>還沒有課堂紀錄，先在上方建立一堂課。</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {lessons.map((l) => (
              <button
                key={l.id}
                onClick={() => setCurrent(l)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  current?.id === l.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white hover:border-slate-500'
                }`}
              >
                {l.lesson_date} 第{l.period}節
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="font-medium">{current.lesson_date} 第 {current.period} 節</p>
                  {current.topic && <p className="text-sm text-slate-500">{current.topic}</p>}
                </div>
                <div className="flex gap-2">
                  <Button onClick={persistAttendance} disabled={saving}>
                    {saving ? '儲存中…' : '儲存點名'}
                  </Button>
                  <Button variant="ghost" onClick={() => removeLesson(current)}>刪除</Button>
                </div>
              </div>

              {students.length === 0 ? (
                <Empty>這個班還沒有學生名單。</Empty>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2">學生</th>
                        <th className="px-3 py-2">出缺席</th>
                        <th className="px-3 py-2">加扣分</th>
                        <th className="px-3 py-2">本堂表現</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const code = attendance[s.id]?.status ?? 'present'
                        const pts = pointsOf(s.id)
                        return (
                          <tr key={s.id} className="border-b border-slate-100 last:border-0 align-top">
                            <td className="whitespace-nowrap px-3 py-2 font-medium">
                              {s.seat_no ? `${s.seat_no}. ` : ''}{s.name}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {statuses.map((st) => (
                                  <button
                                    key={st.code}
                                    onClick={() => setStatus(s.id, st.code)}
                                    className={`rounded px-2 py-1 text-xs transition ${
                                      code === st.code
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {st.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {items.map((it) => (
                                  <button
                                    key={it.id}
                                    onClick={() => addRecord(s.id, it)}
                                    title={`${it.label} ${it.default_points > 0 ? '+' : ''}${it.default_points}`}
                                    className={`rounded px-2 py-1 text-xs transition ${
                                      it.default_points >= 0
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                                    }`}
                                  >
                                    {it.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`font-medium ${pts > 0 ? 'text-emerald-700' : pts < 0 ? 'text-red-700' : 'text-slate-400'}`}>
                                {pts > 0 ? `+${pts}` : pts}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {records.filter((r) => r.student_id === s.id).map((r) => (
                                  <button
                                    key={r.id}
                                    onClick={() => removeRecord(r.id)}
                                    title="點擊移除這筆紀錄"
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-red-100 hover:text-red-700"
                                  >
                                    {r.label} {Number(r.points) > 0 ? '+' : ''}{r.points} ✕
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
