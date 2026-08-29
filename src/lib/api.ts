import { supabase } from './supabase'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus, ClassRow, Lesson,
  PerformanceItem, PerformanceRecord, SeatAssignment, SeatPickingInfo,
  Student, StudentScore, Teacher,
} from './types'

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return data as T
}

/* ---------------------------------------------------------------- 教師 */

export async function ensureTeacher(): Promise<Teacher> {
  return unwrap(await supabase.rpc('hc_ensure_teacher').single())
}

/* ---------------------------------------------------------------- 班級 */

export async function listClasses(): Promise<ClassRow[]> {
  return unwrap(
    await supabase
      .from('hc_classes')
      .select('*')
      .order('academic_year', { ascending: false })
      .order('semester', { ascending: false })
      .order('name'),
  )
}

export async function getClass(id: string): Promise<ClassRow> {
  return unwrap(await supabase.from('hc_classes').select('*').eq('id', id).single())
}

export async function createClass(input: {
  teacher_id: string
  academic_year: number
  semester: number
  name: string
  grade: number | null
  seat_rows: number
  seat_cols: number
}): Promise<ClassRow> {
  return unwrap(await supabase.from('hc_classes').insert(input).select().single())
}

export async function updateClass(id: string, patch: Partial<ClassRow>): Promise<ClassRow> {
  return unwrap(await supabase.from('hc_classes').update(patch).eq('id', id).select().single())
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('hc_classes').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- 學生 */

export async function listStudents(classId: string): Promise<Student[]> {
  return unwrap(
    await supabase
      .from('hc_students')
      .select('*')
      .eq('class_id', classId)
      .order('seat_no', { ascending: true, nullsFirst: false })
      .order('student_no'),
  )
}

export async function upsertStudents(
  rows: Omit<Student, 'id' | 'is_active'>[],
): Promise<Student[]> {
  return unwrap(
    await supabase
      .from('hc_students')
      .upsert(rows, { onConflict: 'class_id,student_no' })
      .select(),
  )
}

export async function updateStudent(id: string, patch: Partial<Student>): Promise<Student> {
  return unwrap(await supabase.from('hc_students').update(patch).eq('id', id).select().single())
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from('hc_students').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- 座位 */

export async function listSeats(classId: string): Promise<SeatAssignment[]> {
  return unwrap(await supabase.from('hc_seat_assignments').select('*').eq('class_id', classId))
}

/** 老師端調位：直接寫表（受 RLS 保護），不走學生用的 RPC */
export async function assignSeat(
  classId: string, studentId: string, row: number, col: number,
): Promise<void> {
  const { error } = await supabase.from('hc_seat_assignments').upsert(
    { class_id: classId, student_id: studentId, seat_row: row, seat_col: col, assigned_by: 'teacher' },
    { onConflict: 'class_id,student_id' },
  )
  if (error) throw error
}

export async function clearSeat(classId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('hc_seat_assignments').delete()
    .eq('class_id', classId).eq('student_id', studentId)
  if (error) throw error
}

/* ------------------------------------------------------- 學生選位（免登入） */

export async function seatPickingInfo(code: string): Promise<SeatPickingInfo> {
  return unwrap(await supabase.rpc('hc_seat_picking_info', { p_code: code }))
}

export async function claimSeat(
  code: string, studentId: string, row: number, col: number, studentNo?: string,
): Promise<void> {
  const { error } = await supabase.rpc('hc_claim_seat', {
    p_code: code,
    p_student_id: studentId,
    p_seat_row: row,
    p_seat_col: col,
    p_student_no: studentNo ?? null,
  })
  if (error) throw error
}

/* ---------------------------------------------------------------- 課堂 */

export async function listLessons(classId: string): Promise<Lesson[]> {
  return unwrap(
    await supabase.from('hc_lessons').select('*').eq('class_id', classId)
      .order('lesson_date', { ascending: false }).order('period', { ascending: false }),
  )
}

export async function createLesson(input: {
  class_id: string; lesson_date: string; period: number; topic: string; created_by: string
}): Promise<Lesson> {
  return unwrap(await supabase.from('hc_lessons').insert(input).select().single())
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from('hc_lessons').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- 點名 */

export async function listAttendanceStatuses(): Promise<AttendanceStatus[]> {
  return unwrap(
    await supabase.from('hc_attendance_statuses').select('*')
      .eq('is_active', true).order('sort_order'),
  )
}

export async function listAttendance(lessonId: string): Promise<AttendanceRow[]> {
  return unwrap(await supabase.from('hc_attendance').select('*').eq('lesson_id', lessonId))
}

export async function saveAttendance(
  rows: { lesson_id: string; student_id: string; status: AttendanceCode; points: number; note: string; recorded_by: string }[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('hc_attendance').upsert(rows, { onConflict: 'lesson_id,student_id' })
  if (error) throw error
}

/* -------------------------------------------------------------- 上課表現 */

export async function listPerformanceItems(): Promise<PerformanceItem[]> {
  return unwrap(
    await supabase.from('hc_performance_items').select('*')
      .eq('is_active', true).order('sort_order'),
  )
}

export async function listPerformanceRecords(lessonId: string): Promise<PerformanceRecord[]> {
  return unwrap(
    await supabase.from('hc_performance_records').select('*')
      .eq('lesson_id', lessonId).order('created_at', { ascending: false }),
  )
}

export async function addPerformanceRecord(input: {
  lesson_id: string; student_id: string; item_id: string | null
  label: string; points: number; reason: string; created_by: string
}): Promise<PerformanceRecord> {
  return unwrap(await supabase.from('hc_performance_records').insert(input).select().single())
}

export async function deletePerformanceRecord(id: string): Promise<void> {
  const { error } = await supabase.from('hc_performance_records').delete().eq('id', id)
  if (error) throw error
}

/* ---------------------------------------------------------------- 統計 */

export async function listScores(classId: string): Promise<StudentScore[]> {
  return unwrap(
    await supabase.from('hc_student_scores').select('*')
      .eq('class_id', classId).order('seat_no', { ascending: true, nullsFirst: false }),
  )
}
