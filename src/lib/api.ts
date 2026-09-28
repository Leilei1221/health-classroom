import { supabase } from './supabase'
import type {
  AttendanceCode, AttendanceRow, AttendanceStatus, ClassRow, Lesson,
  ImportResult, LinkRow, PerformanceItem, PerformanceRecord, RosterRow, SeatAssignment,
  SeatPickingInfo, Student, StudentLink, StudentScore, Teacher,
} from './types'

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return data as T
}

/* ---------------------------------------------------------------- 教師 */

export async function ensureTeacher(): Promise<Teacher> {
  return unwrap(await supabase.rpc('hc_ensure_teacher').single())
}

/**
 * 查登入者現有的教師檔案。唯讀 —— 沒有就回傳 null，不會順手建立。
 * 用來在判定身分時區分「已經是老師」與「第一次登入的人」，
 * ensureTeacher() 會建立教師列，不能拿來做這個判斷。
 */
export async function findTeacher(userId: string): Promise<Teacher | null> {
  const { data, error } = await supabase
    .from('hc_teachers').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
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
  group_count: number
  group_capacity: number
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

/**
 * 老師端調位。目標位子若已有別人，會在同一個 transaction 內把兩人對調，
 * 因此不會撞到 (class_id, group_no, seat_slot) 的唯一鍵。
 * 回傳被換走的學生 id（單純移到空位時為 null）。
 */
export async function moveSeat(
  classId: string, studentId: string, groupNo: number, seatSlot: number,
): Promise<{ swapped_with: string | null }> {
  return unwrap(
    await supabase.rpc('hc_move_seat', {
      p_class_id: classId,
      p_student_id: studentId,
      p_group_no: groupNo,
      p_seat_slot: seatSlot,
    }),
  )
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
  code: string, studentId: string, groupNo: number, seatSlot: number, studentNo?: string,
): Promise<void> {
  const { error } = await supabase.rpc('hc_claim_seat', {
    p_code: code,
    p_student_id: studentId,
    p_group_no: groupNo,
    p_seat_slot: seatSlot,
    p_student_no: studentNo ?? null,
  })
  if (error) throw error
}

/* ------------------------------------------------------------ 名單匯入 */

/** 依 Excel 內容自動建立班級並寫入學生；同學號者更新而非重複建立 */
export async function importRoster(input: {
  academic_year: number
  semester: number
  filename: string
  default_group_count: number
  default_group_capacity: number
  classes: { name: string; group_count: number; group_capacity: number }[]
  rows: RosterRow[]
}): Promise<ImportResult> {
  return unwrap(await supabase.rpc('hc_import_roster', { p_payload: input }))
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

/* ---------------------------------------------------------------- 課程活動連結 */

/**
 * 教師端：自己建的連結。RLS 已經限制成只看得到自己的，
 * 這裡不再多一個 .eq('teacher_id', …) —— 條件寫兩份，改一邊忘另一邊就會對不上。
 */
export async function listLinks(): Promise<LinkRow[]> {
  return unwrap(
    await supabase.from('hc_links').select('*')
      .order('sort_order').order('title'),
  )
}

/** 連結與班級的對照。all_classes = false 的連結才用得到 */
export async function listLinkClasses(): Promise<{ link_id: string; class_id: string }[]> {
  return unwrap(await supabase.from('hc_link_classes').select('link_id, class_id'))
}

export async function createLink(input: {
  teacher_id: string
  title: string
  url: string
  description: string | null
  visible: boolean
  sort_order: number
  all_classes: boolean
}): Promise<LinkRow> {
  return unwrap(await supabase.from('hc_links').insert(input).select().single())
}

export async function updateLink(id: string, patch: Partial<LinkRow>): Promise<LinkRow> {
  return unwrap(await supabase.from('hc_links').update(patch).eq('id', id).select().single())
}

export async function deleteLink(id: string): Promise<void> {
  const { error } = await supabase.from('hc_links').delete().eq('id', id)
  if (error) throw error
}

/**
 * 重設一個連結開放給哪些班。先刪後插，不做差異比對——
 * 一個連結最多就幾個班，而差異比對寫錯的話會留下對不到的列。
 *
 * 不在交易裡：中間失敗的結果是「這個連結暫時沒有指定班級」，
 * 學生端因此看不到它。看不到比多看到安全，而且再按一次儲存就會補上。
 */
export async function setLinkClasses(linkId: string, classIds: string[]): Promise<void> {
  const del = await supabase.from('hc_link_classes').delete().eq('link_id', linkId)
  if (del.error) throw del.error
  if (classIds.length === 0) return
  const ins = await supabase.from('hc_link_classes')
    .insert(classIds.map((class_id) => ({ link_id: linkId, class_id })))
  if (ins.error) throw ins.error
}

/**
 * 學生端：我看得到的課程活動。
 *
 * 這支 RPC 回來的清單**已經過濾好**（只有這位學生的班級看得到、而且 visible 的），
 * 也已經照 sort_order 排好。前端不要再過濾或排序一次——
 * 條件寫兩份，改一邊忘另一邊就會出現「老師關掉了但學生還看得到」。
 */
export async function myLinks(): Promise<StudentLink[]> {
  return unwrap(await supabase.rpc('hc_my_links'))
}
