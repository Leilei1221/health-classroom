import { useCallback, useEffect, useState } from 'react'
import GroupSeatMap, { type SeatOccupant, type SeatTone } from './GroupSeatMap'
import SeatAttendanceDialog from './SeatAttendanceDialog'
import { Button, Empty, ErrorBox, Field, Spinner, inputClass } from './ui'
import {
  addPerformanceRecord, createLesson, deleteLesson, deletePerformanceRecord,
  listAttendance, listAttendanceStatuses, listLessons, listPerformanceItems,
  listPerformanceRecords, listSeats, listStudents, saveAttendance,
} from '../lib/api'
import { friendlyError } from '../lib/errors'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus, ClassRow, Lesson,
  PerformanceItem, PerformanceRecord, SeatAssignment, Student,
} from '../lib/types'

type Mode = 'list' | 'seatmap'

const MODE_KEY = 'hc.attendanceMode'

function initialMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'seatmap' ? 'seatmap' : 'list'
  } catch {
    return 'list'
  }
}

/** 出缺席狀態對應座位圖上的底色與小標籤 */
const TONE_OF: Record<AttendanceCode, SeatTone> = {
  present: 'present', late: 'late', absent: 'absent', leave: 'leave', official: 'official',
}
const BADGE_OF: Record<AttendanceCode, string> = {
  present: '', late: '遲', absent: '曠', leave: '假', official: '公',
}

const today = () => new Date().toISOString().slice(0, 10)

export default function LessonPanel({ cls, teacherId }: {
  cls: ClassRow
  teacherId: string
}) {
  const classId = cls.id
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
  const [mode, setMode] = useState<Mode>(initialMode)
  const [seats, setSeats] = useState<SeatAssignment[]>([])
  const [openStudent, setOpenStudent] = useState<string | null>(null)
  // 座號模式是「先改本地、按鈕才寫入」；記下實際被改過的學生，
  // 切換模式時只寫入這些人，其餘維持「未點名」讓座位圖看得出還有誰沒點
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listStudents(classId), listLessons(classId),
      listAttendanceStatuses(), listPerformanceItems(), listSeats(classId),
    ])
      .then(([st, ls, sts, its, se]) => {
        setStudents(st); setLessons(ls); setStatuses(sts); setItems(its); setSeats(se)
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

  /** 座號模式：只更新本地狀態，按「儲存點名」才寫入資料庫 */
  const setStatus = (studentId: string, code: AttendanceCode) => {
    setDirtyIds((prev) => new Set(prev).add(studentId))
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
      setDirtyIds(new Set())
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  /**
   * 座位圖模式：單一學生立即寫入。
   * 老師在教室裡點完就走，不應該還要記得按儲存。
   */
  const setStatusNow = async (studentId: string, code: AttendanceCode) => {
    if (!current) return
    const def = statuses.find((x) => x.code === code)
    setSaving(true); setError('')
    try {
      await saveAttendance([{
        lesson_id: current.id,
        student_id: studentId,
        status: code,
        points: def?.default_points ?? 0,
        note: attendance[studentId]?.note ?? '',
        recorded_by: teacherId,
      }])
      setAttendance(Object.fromEntries(
        (await listAttendance(current.id)).map((a) => [a.student_id, a]),
      ))
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  /**
   * 切換模式前，把座號模式改過但還沒存的點名寫入，避免切過去就不見。
   * 只寫入實際被改動的學生：若比照「儲存點名」把全班都寫成出席，
   * 座位圖上就再也看不出還有誰沒點名了。
   */
  const switchMode = async (next: Mode) => {
    if (next === mode) return
    if (dirtyIds.size > 0 && current) {
      setSaving(true); setError('')
      try {
        await saveAttendance(
          [...dirtyIds].map((id) => {
            const a = attendance[id]
            const code: AttendanceCode = a?.status ?? 'present'
            const def = statuses.find((x) => x.code === code)
            return {
              lesson_id: current.id,
              student_id: id,
              status: code,
              points: a?.points ?? def?.default_points ?? 0,
              note: a?.note ?? '',
              recorded_by: teacherId,
            }
          }),
        )
        setAttendance(Object.fromEntries(
          (await listAttendance(current.id)).map((a) => [a.student_id, a]),
        ))
        setDirtyIds(new Set())
      } catch (e) {
        setError(friendlyError(e))
        setSaving(false)
        return // 沒存成功就不切換，避免使用者以為已經保住了
      }
      setSaving(false)
    }
    setMode(next)
    setOpenStudent(null)
    try { localStorage.setItem(MODE_KEY, next) } catch { /* 隱私模式下忽略 */ }
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

  const studentOf = (id: string) => students.find((s) => s.id === id)
  const seatOf = (studentId: string) => seats.find((x) => x.student_id === studentId)

  /** 座位圖上每個位子的顯示：底色為出缺席、右上角小標籤、下方為加扣分 */
  const occupants: SeatOccupant[] = seats
    .filter((seat) => studentOf(seat.student_id))
    .map((seat) => {
      const st = studentOf(seat.student_id)!
      const code = attendance[st.id]?.status
      const pts = pointsOf(st.id)
      return {
        group_no: seat.group_no,
        seat_slot: seat.seat_slot,
        label: st.name,
        state: st.id === openStudent ? 'selected' : 'taken',
        tone: code ? TONE_OF[code] : 'unmarked',
        badge: code ? BADGE_OF[code] || undefined : undefined,
        sublabel: pts !== 0 ? `${pts > 0 ? '+' : ''}${pts}` : undefined,
      }
    })

  const unseated = students.filter((s) => !seatOf(s.id))
  const marked = students.filter((s) => attendance[s.id]).length

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

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
                  {([
                    { key: 'list' as const, label: '座號模式' },
                    { key: 'seatmap' as const, label: '座位圖模式' },
                  ]).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => void switchMode(m.key)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                        mode === m.key
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-500">
                  已點名 {marked}/{students.length}
                  {mode === 'seatmap' && ' · 點座位即可修改，變更立即儲存'}
                  {mode === 'list' && dirtyIds.size > 0 && ` · ${dirtyIds.size} 筆未儲存`}
                </span>
              </div>

              {students.length === 0 ? (
                <Empty>這個班還沒有學生名單。</Empty>
              ) : mode === 'seatmap' ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <GroupSeatMap
                      groupCount={cls.group_count}
                      groupCapacity={cls.group_capacity}
                      capacityOverrides={cls.group_capacity_overrides}
                      occupants={occupants}
                      showCounts={false}
                      onSelect={(g, slot) => {
                        const seat = seats.find((x) => x.group_no === g && x.seat_slot === slot)
                        if (seat) setOpenStudent(seat.student_id)
                      }}
                    />
                    <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                      {statuses.map((st) => (
                        <span key={st.code} className="inline-flex items-center gap-1.5">
                          <span className={`inline-block h-3 w-3 rounded border ${{
                            present: 'border-slate-300 bg-white',
                            late: 'border-amber-400 bg-amber-50',
                            absent: 'border-red-400 bg-red-50',
                            leave: 'border-sky-400 bg-sky-50',
                            official: 'border-violet-400 bg-violet-50',
                          }[st.code]}`} />
                          {st.label}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded border border-slate-200 bg-slate-50" />
                        未點名
                      </span>
                    </div>
                  </div>

                  {unseated.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-2 text-sm font-medium">
                        尚未選位（{unseated.length}）— 一樣可以點名
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {unseated.map((s) => {
                          const code = attendance[s.id]?.status
                          return (
                            <button
                              key={s.id}
                              onClick={() => setOpenStudent(s.id)}
                              className={`rounded-full border px-3 py-1 text-sm transition ${
                                code
                                  ? 'border-slate-400 bg-slate-50 text-slate-800'
                                  : 'border-dashed border-slate-300 text-slate-500 hover:border-slate-500'
                              }`}
                            >
                              {s.seat_no ? `${s.seat_no}. ` : ''}{s.name}
                              {code && BADGE_OF[code] && ` (${BADGE_OF[code]})`}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
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

      {openStudent && current && studentOf(openStudent) && (
        <SeatAttendanceDialog
          student={studentOf(openStudent)!}
          seatLabel={(() => {
            const seat = seatOf(openStudent)
            return seat ? `第 ${seat.group_no} 組 第 ${seat.seat_slot} 位` : '尚未選位'
          })()}
          attendance={attendance[openStudent]}
          statuses={statuses}
          items={items}
          records={records}
          busy={saving}
          onSetStatus={(code) => void setStatusNow(openStudent, code)}
          onAddRecord={(item) => void addRecord(openStudent, item)}
          onRemoveRecord={(id) => void removeRecord(id)}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </div>
  )
}
