import { supabase } from '../lib/supabase'
import type { HealthMeasurement, MeasurementRound, StudentProfile } from '../lib/types'

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return data as T
}

/**
 * 取得登入者的學生身分。
 * 查得到 = 學生；空陣列 = 不是學生（教師或校外帳號）。
 */
export async function myStudentProfile(): Promise<StudentProfile[]> {
  return unwrap(await supabase.rpc('hc_my_student_profile'))
}

/** 學年度學期組成資料表用的 semester 字串 */
export const semesterKey = (p: StudentProfile) => `${p.academic_year}-${p.semester}`

export async function getMeasurement(
  email: string, semester: string, round: MeasurementRound,
): Promise<HealthMeasurement | null> {
  const { data, error } = await supabase
    .from('hc_health_measurement')
    .select('*')
    .eq('student_email', email)
    .eq('semester', semester)
    .eq('round', round)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * 送出或更新量測。
 * 以 (student_email, semester, round) 為唯一鍵 upsert，
 * 學生重新送出是更新同一筆，不會愈積愈多。
 */
export async function saveMeasurement(
  row: Partial<HealthMeasurement> & { student_email: string; semester: string; round: MeasurementRound },
): Promise<HealthMeasurement> {
  return unwrap(
    await supabase
      .from('hc_health_measurement')
      .upsert(row, { onConflict: 'student_email,semester,round' })
      .select()
      .single(),
  )
}
