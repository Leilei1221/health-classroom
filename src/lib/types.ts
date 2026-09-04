export type AttendanceCode = 'present' | 'late' | 'absent' | 'leave' | 'official'

export interface Teacher {
  id: string
  email: string
  display_name: string
  role: 'teacher' | 'admin'
}

export interface ClassRow {
  id: string
  teacher_id: string
  academic_year: number
  semester: number
  name: string
  grade: number | null
  group_count: number
  group_capacity: number
  join_code: string
  seat_picking_open: boolean
  seat_picking_require_student_no: boolean
  is_active: boolean
}

export interface Student {
  id: string
  class_id: string
  student_no: string
  seat_no: number | null
  name: string
  gender: 'M' | 'F' | 'X' | null
  note: string
  is_active: boolean
}

export interface SeatAssignment {
  id: string
  class_id: string
  student_id: string
  group_no: number
  seat_slot: number
  assigned_by: 'student' | 'teacher'
}

export interface Lesson {
  id: string
  class_id: string
  lesson_date: string
  period: number
  topic: string
  note: string
}

export interface AttendanceStatus {
  code: AttendanceCode
  label: string
  default_points: number
  requires_note: boolean
  sort_order: number
  is_active: boolean
}

export interface AttendanceRow {
  id: string
  lesson_id: string
  student_id: string
  status: AttendanceCode
  points: number
  note: string
}

export interface PerformanceItem {
  id: string
  teacher_id: string | null
  code: string
  label: string
  default_points: number
  category: string
  sort_order: number
  is_active: boolean
}

export interface PerformanceRecord {
  id: string
  lesson_id: string
  student_id: string
  item_id: string | null
  label: string
  points: number
  reason: string
  created_at: string
}

export interface StudentScore {
  student_id: string
  class_id: string
  student_no: string
  seat_no: number | null
  name: string
  attendance_points: number
  performance_points: number
  total_points: number
  late_count: number
  absent_count: number
  performance_record_count: number
}

/** 學生選位頁（免登入）由 hc_seat_picking_info RPC 回傳的結構 */
export interface SeatPickingInfo {
  class: {
    id: string
    name: string
    group_count: number
    group_capacity: number
    require_student_no: boolean
  }
  students: { id: string; seat_no: number | null; name: string }[]
  occupied: { group_no: number; seat_slot: number; student_id: string }[]
}

/** Excel 名單匯入的一列 */
export interface RosterRow {
  class_name: string
  seat_no: string
  student_no: string
  name: string
}

export interface ImportResult {
  batch_id: string
  classes: { class_id: string; name: string; created: boolean; group_count: number; group_capacity: number }[]
  classes_created: number
  inserted: number
  updated: number
}

/* ---------------------------------------------------------------- 健康管理 */

/** hc_my_student_profile() 回傳的學生本人資料 */
export interface StudentProfile {
  student_id: string
  class_id: string
  class_name: string
  academic_year: number
  semester: number
  student_no: string
  seat_no: number | null
  name: string
  email: string
}

export type MeasurementRound = 'initial' | 'mid' | 'final'

export interface HealthMeasurement {
  id: string
  student_email: string
  semester: string          // 例：'115-1'
  measured_at: string
  round: MeasurementRound

  machine_no: string | null
  height_cm: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  visceral_fat: number | null
  bmr_kcal: number | null
  body_age: number | null
  waist_cm: number | null
  hip_cm: number | null
  sbp: number | null
  dbp: number | null
  pulse: number | null
  spo2: number | null

  subcut_whole: number | null
  subcut_trunk: number | null
  subcut_arms: number | null
  subcut_legs: number | null
  muscle_whole: number | null
  muscle_trunk: number | null
  muscle_arms: number | null
  muscle_legs: number | null
}
