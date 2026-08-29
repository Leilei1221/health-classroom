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
  seat_rows: number
  seat_cols: number
  disabled_seats: { row: number; col: number }[]
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
  seat_row: number
  seat_col: number
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
    seat_rows: number
    seat_cols: number
    disabled_seats: { row: number; col: number }[]
    require_student_no: boolean
  }
  students: { id: string; seat_no: number | null; name: string }[]
  occupied: { seat_row: number; seat_col: number; student_id: string }[]
}
