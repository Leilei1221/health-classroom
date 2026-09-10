import { useEffect, useState } from 'react'
import { Button, Empty, ErrorBox, Spinner, inputClass } from './ui'
import { deleteStudent, listStudents, upsertStudents } from '../lib/api'
import { friendlyError } from '../lib/errors'
import type { Student } from '../lib/types'

/**
 * 貼上 Excel 欄位（學號 / 座號 / 姓名），以 Tab 或逗號分隔。
 *
 * serialSeat 為 true 時忽略貼上的座號，改用貼上順序的流水號。
 * 多元選修這類跨班課程的學生來自不同原班，原班座號會重複，
 * 而資料庫的座號在同一個班內必須唯一（hc_students_seat_no_key）。
 * 這種情況下班級與座號的資訊放在姓名裡（例：「20106林宥漢」），
 * 座號只當作課堂內的排序用。
 */
function parsePasted(text: string, classId: string, serialSeat: boolean) {
  const rows: Omit<Student, 'id' | 'is_active'>[] = []
  const errors: string[] = []
  text.split('\n').forEach((line, i) => {
    const raw = line.trim()
    if (!raw) return
    const parts = raw.split(/[\t,]/).map((p) => p.trim())
    if (parts.length < 3) { errors.push(`第 ${i + 1} 行欄位不足：「${raw}」`); return }
    const [studentNo, seatNo, name] = parts
    if (!studentNo || !name) { errors.push(`第 ${i + 1} 行缺少學號或姓名：「${raw}」`); return }
    const seat = seatNo ? Number(seatNo) : NaN
    rows.push({
      class_id: classId,
      student_no: studentNo,
      seat_no: serialSeat ? rows.length + 1 : (Number.isFinite(seat) ? seat : null),
      name,
      gender: null,
      note: '',
    })
  })
  return { rows, errors }
}

/** 找出重複的座號，回傳「座號 → 該座號的姓名」 */
function duplicateSeats(rows: Omit<Student, 'id' | 'is_active'>[]) {
  const bySeat = new Map<number, string[]>()
  rows.forEach((r) => {
    if (r.seat_no == null) return
    bySeat.set(r.seat_no, [...(bySeat.get(r.seat_no) ?? []), r.name])
  })
  return [...bySeat.entries()].filter(([, names]) => names.length > 1)
}

export default function RosterPanel({ classId }: { classId: string }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paste, setPaste] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [serialSeat, setSerialSeat] = useState(false)

  const reload = () => {
    setLoading(true)
    listStudents(classId)
      .then(setStudents)
      .catch((e) => setError(friendlyError(e)))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [classId])

  const doImport = async () => {
    const { rows, errors } = parsePasted(paste, classId, serialSeat)
    if (errors.length) { setError(errors.slice(0, 5).join('；')); return }
    if (!rows.length) { setError('沒有可匯入的資料'); return }

    // 先自己擋下來並說清楚，否則使用者只會看到資料庫丟出的
    // duplicate key value violates unique constraint 這種訊息
    const dups = duplicateSeats(rows)
    if (dups.length) {
      setError(
        `座號重複：${dups.map(([seat, names]) => `${seat} 號（${names.join('、')}）`).join('；')}。` +
        '同一個班的座號必須唯一。多元選修這類跨班課程請勾選下方的「座號改用流水號」。',
      )
      return
    }

    setError('')
    try {
      await upsertStudents(rows)
      setPaste(''); setShowImport(false); reload()
    } catch (e) { setError(friendlyError(e)) }
  }

  const remove = async (s: Student) => {
    if (!confirm(`確定要刪除「${s.name}」？相關的點名與表現紀錄也會一併刪除。`)) return
    try { await deleteStudent(s.id); reload() } catch (e) { setError(friendlyError(e)) }
  }

  /** 清空全班名單 */
  const removeAll = async () => {
    if (students.length === 0) return
    if (!confirm(`確定要清空全班 ${students.length} 位學生嗎？\n\n⚠️ 所有學生的座位、點名與表現紀錄都會一併刪除，此操作無法復原。`)) return
    setError('')
    try {
      for (const s of students) {
        await deleteStudent(s.id)
      }
      reload()
    } catch (e) { setError(friendlyError(e)) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">共 {students.length} 位學生</p>
        <div className="flex gap-2">
          {students.length > 0 && (
            <Button variant="danger" onClick={removeAll}>清空全班名單</Button>
          )}
          <Button onClick={() => setShowImport((v) => !v)}>
            {showImport ? '取消' : '匯入名單'}
          </Button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {showImport && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            從 Excel 複製「學號、座號、姓名」三欄後貼在這裡，一行一位學生。
            學號相同者會更新既有資料，不會重複建立。
          </p>
          <textarea
            className={`${inputClass} h-40 font-mono text-xs`}
            placeholder={'410101\t1\t王小明\n410102\t2\t李小華'}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={serialSeat}
              onChange={(e) => setSerialSeat(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              座號改用流水號（多元選修等跨班課程）
              <span className="block text-xs text-slate-500">
                學生來自不同原班時原班座號會重複，勾選後改用貼上順序 1、2、3…。
                原班與座號請放在姓名裡，例如「20106林宥漢」。
              </span>
            </span>
          </label>
          <Button onClick={doImport}>匯入</Button>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : students.length === 0 ? (
        <Empty>還沒有學生名單，請先匯入。</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">座號</th>
                <th className="px-3 py-2">學號</th>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">備註</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-slate-500">{s.seat_no ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.student_no}</td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-slate-500">{s.note || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" onClick={() => remove(s)}>刪除</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
