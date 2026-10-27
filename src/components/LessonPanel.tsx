import { useCallback, useEffect, useState } from 'react'
import GroupSeatMap, { type SeatOccupant, type SeatTone } from './GroupSeatMap'
import SeatAttendanceDialog, { AttendancePanelEmpty } from './SeatAttendanceDialog'
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

/** iPad 橫向以上（≥1024px）：點名面板固定在座位圖右側，不用彈出視窗 */
function useWide() {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

const today = () => new Date().toISOString().slice(0, 10)

export default function LessonPanel({ cls, teacherId }: {
  cls: ClassRow
  teacherId: string
}) {
  const classId = cls.id
  const wide = useWide()
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
  // 要填理由的項目：按下去先記在這裡，填完（或留空按確定）才寫入
  const [noteFor, setNoteFor] = useState<{ studentId: string; item: PerformanceItem } | null>(null)
  const [note, setNote] = useState('')

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

  /**
   * 記一筆表現。
   *
   * requires_note 的項目（目前是「其他」）先跳輸入框讓老師打一行字，
   * 不是直接寫進去——不然事後看到一排「其他 -1」會想不起來發生什麼事。
   * 判斷條件讀資料庫欄位而不是寫死 code === 'other'，
   * 日後想讓別的項目也能填理由，改一列資料就好。
   */
  const addRecord = async (studentId: string, item: PerformanceItem) => {
    if (item.requires_note) { setNoteFor({ studentId, item }); setNote(''); return }
    await writeRecord(studentId, item, '')
  }

  const writeRecord = async (studentId: string, item: PerformanceItem, text: string) => {
    if (!current) return
    const note = text.trim()
    try {
      await addPerformanceRecord({
        lesson_id: current.id,
        student_id: studentId,
        item_id: item.id,
        // 理由併進 label，本堂紀錄那排才看得出是哪一件事；
        // 同時原樣存進 reason，之後要做統計不用再從 label 拆字串
        label: note ? `${item.label}：${note}` : item.label,
        points: item.default_points,
        reason: note,
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

  /** 點名視窗（窄螢幕）或右側面板（寬螢幕）：內容相同 */
  const attendanceFor = (variant: 'modal' | 'panel') => (
        <SeatAttendanceDialog
          variant={variant}
          student={studentOf(openStudent!)!}
          seatLabel={(() => {
            const seat = seatOf(openStudent!)
            return seat ? `第 ${seat.group_no} 組 第 ${seat.seat_slot} 位` : '尚未選位'
          })()}
          attendance={attendance[openStudent!]}
          statuses={statuses}
          items={items}
          records={records}
          busy={saving}
          onSetStatus={(code) => void setStatusNow(openStudent!, code)}
          onAddRecord={(item) => void addRecord(openStudent!, item)}
          onRemoveRecord={(id) => void removeRecord(id)}
          onClose={() => setOpenStudent(null)}
        />
  )

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3 cute-card rounded-3xl p-4 sm:grid-cols-4">
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
                className={`cute-chip !min-h-[40px] text-[13px] ${current?.id === l.id ? 'bg-cute-yellow' : 'bg-white'}`}
              >
                {l.lesson_date} 第{l.period}節
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="flex items-center justify-between cute-card rounded-3xl p-4">
                <div>
                  <p className="text-base font-bold">{current.lesson_date} 第 {current.period} 節</p>
                  {current.topic && <p className="text-sm text-cute-mute">{current.topic}</p>}
                </div>
                <div className="flex gap-2">
                  <Button onClick={persistAttendance} disabled={saving}>
                    {saving ? '儲存中…' : '儲存點名'}
                  </Button>
                  <Button variant="ghost" onClick={() => removeLesson(current)}>刪除</Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2.5">
                  {([
                    { key: 'list' as const, label: '座號模式' },
                    { key: 'seatmap' as const, label: '座位圖模式' },
                  ]).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => void switchMode(m.key)}
                      className={`cute-chip ${mode === m.key ? 'bg-cute-yellow' : 'bg-white'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <span className="cute-inset rounded-full bg-cute-butter px-4 py-1.5 text-xs text-cute-mute">
                  <b className="text-sm text-cute-ink">已點名 {marked}/{students.length}</b>
                  {marked < students.length && (
                    <b className="ml-1.5 text-sm text-[#7A4A08]">還有 {students.length - marked} 位未點名</b>
                  )}
                  {mode === 'seatmap' && ' · 點座位即可修改，變更立即儲存'}
                  {mode === 'list' && dirtyIds.size > 0 && ` · ${dirtyIds.size} 筆未儲存`}
                </span>
              </div>

              {students.length === 0 ? (
                <Empty>這個班還沒有學生名單。</Empty>
              ) : mode === 'seatmap' ? (
                <div className={wide ? 'grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5' : ''}>
                <div className="space-y-4">
                  <div className="cute-card rounded-3xl p-4">
                    <GroupSeatMap
                      variant="cute"
                      wide
                      showLegend={false}
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
                    <div className="mt-4 flex flex-wrap justify-center gap-x-3.5 gap-y-2 text-xs text-cute-mute">
                      {statuses.map((st) => (
                        <span key={st.code} className="inline-flex items-center gap-1.5">
                          <span className={`inline-block h-4 w-4 rounded-md border-2 border-cute-ink ${{
                            present: 'bg-white',
                            late: 'bg-cute-yellow',
                            absent: 'bg-cute-pink',
                            leave: 'bg-cute-blue',
                            official: 'bg-cute-lavender',
                          }[st.code]}`} />
                          {st.label}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-4 w-4 rounded-md border-2 border-dashed border-cute-ink/55 bg-cute-cream" />
                        未點名
                      </span>
                    </div>
                  </div>

                  {unseated.length > 0 && (
                    <div className="cute-card rounded-3xl p-4">
                      <h3 className="mb-2.5 text-sm font-bold text-cute-ink">
                        尚未選位（{unseated.length}）— 一樣可以點名
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {unseated.map((s) => {
                          const code = attendance[s.id]?.status
                          return (
                            <button
                              key={s.id}
                              onClick={() => setOpenStudent(s.id)}
                              className={`cute-chip ${code ? 'bg-white' : 'border-dashed bg-cute-cream !shadow-none text-cute-mute'}`}
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
                {wide && (
                  <div className="sticky top-24">
                    {openStudent && current && studentOf(openStudent)
                      ? attendanceFor('panel')
                      : <AttendancePanelEmpty />}
                  </div>
                )}
                </div>
              ) : (
                <div className="cute-card overflow-x-auto rounded-3xl">
                  <table className="w-full text-sm">
                    <thead className="border-b-2 border-cute-ink/15 bg-cute-butter text-left text-xs text-cute-mute">
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
                          <tr key={s.id} className="border-b border-white/60 last:border-0 align-top">
                            <td className="whitespace-nowrap px-3 py-2 font-medium">
                              {s.seat_no ? `${s.seat_no}. ` : ''}{s.name}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {statuses.map((st) => (
                                  <button
                                    key={st.code}
                                    onClick={() => setStatus(s.id, st.code)}
                                    className={`rounded-full border-2 border-cute-ink px-2.5 py-1 text-xs font-bold transition ${code === st.code ? 'bg-cute-yellow shadow-[1.5px_2px_0_#3A3535]' : 'bg-white hover:bg-cute-butter'}`}
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
                                    className={`rounded-full border-2 border-cute-ink px-2.5 py-1 text-xs font-bold transition ${it.default_points >= 0 ? 'bg-cute-green' : 'bg-cute-pink'} shadow-[1.5px_2px_0_#3A3535]`}
                                  >
                                    {it.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`font-medium ${pts > 0 ? 'text-[#2F5B45]' : pts < 0 ? 'text-[#9A3834]' : 'text-cute-mute'}`}>
                                {pts > 0 ? `+${pts}` : pts}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {records.filter((r) => r.student_id === s.id).map((r) => (
                                  <button
                                    key={r.id}
                                    onClick={() => removeRecord(r.id)}
                                    title="點擊移除這筆紀錄"
                                    className="rounded-full border-2 border-cute-ink bg-cute-cream px-2 py-0.5 text-[10px] font-bold text-cute-ink hover:bg-cute-pink"
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

      {!wide && openStudent && current && studentOf(openStudent) && attendanceFor('modal')}

      {noteFor && (
        <NotePrompt
          title={noteFor.item.label}
          points={noteFor.item.default_points}
          studentName={studentOf(noteFor.studentId)?.name ?? ''}
          value={note}
          onChange={setNote}
          onCancel={() => setNoteFor(null)}
          onConfirm={() => {
            const { studentId, item } = noteFor
            setNoteFor(null)
            void writeRecord(studentId, item, note)
          }}
        />
      )}
    </div>
  )
}

/**
 * 「其他」按下去跳的輸入框。
 *
 * 理由可以留空——老師在教室裡有時就是先記下來、事後再說，
 * 留空就記成原本的項目名稱，不會擋著她。
 * z-60 是為了蓋在座位圖的點名視窗（z-50）上面。
 */
function NotePrompt({ title, points, studentName, value, onChange, onCancel, onConfirm }: {
  title: string
  points: number
  studentName: string
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${studentName} ${title}`}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-cute-ink/50 p-0 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="cute-card w-full max-w-sm rounded-t-[28px] bg-white p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">
          {studentName}　{title}
          <span className="ml-1.5 text-sm font-normal text-[#7A3434]">
            {points > 0 ? '+' : ''}{points}
          </span>
        </h3>
        <p className="mt-1 text-xs text-cute-mute">可以留空，之後再補。</p>
        <input
          autoFocus
          value={value}
          maxLength={20}
          placeholder="發生什麼事（選填）"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm()
            if (e.key === 'Escape') onCancel()
          }}
          className={`${inputClass} mt-3`}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>取消</Button>
          <Button onClick={onConfirm}>記下來</Button>
        </div>
      </div>
    </div>
  )
}
