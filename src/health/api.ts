import { supabase } from '../lib/supabase'
import type {
  HealthMeasurement, HealthSelfcheck, MeasurementRound, StudentProfile,
} from '../lib/types'

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

/* ------------------------------------------------------------ 自我檢測與餐盤 */

export async function getSelfcheck(
  email: string, semester: string,
): Promise<HealthSelfcheck | null> {
  const { data, error } = await supabase
    .from('hc_health_selfcheck')
    .select('*')
    .eq('student_email', email)
    .eq('semester', semester)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 紅旗規則。交接文件第 5 節明定不可更動 */
export function computeFollowup(row: {
  mood_scale?: number | null
  stress_level?: number | null
  depression?: number | null
  depression_critical?: boolean | null
}): boolean {
  return (
    (row.mood_scale ?? -1) >= 10        // 心情溫度計 中度以上
    || (row.stress_level ?? -1) >= 6    // 壓力偵測站 6 項以上
    || (row.depression ?? -1) >= 12     // 情緒自我檢視表 12 分以上
    || row.depression_critical === true // 第 20 題勾選，不看總分
  )
}

/** 一份量表或餐盤送出時要更新的欄位 */
export type SelfcheckPatch = Partial<
  Pick<HealthSelfcheck,
    'lifestyle' | 'h85210' | 'diet_type' | 'sleep_isi' | 'mood_scale'
    | 'stress_level' | 'depression' | 'depression_critical' | 'plate'>
>

/**
 * 送出一份量表（或餐盤）。
 *
 * 七份量表可以分不同節課做，所以這裡只帶這一份自己的欄位去 upsert，
 * 沒做的欄位不會被寫成 null 蓋掉。
 *
 * 送出前會先把整列讀回來，理由有兩個：
 *
 * 1. needs_followup 要看整列重算，不能只看這一份。
 * 2. depression_critical 只能 false → true，不能 true → false。
 *    學生勾了第 20 題、看到關懷文案後緊張改答案重送，這個旗子必須留著——
 *    誤放的代價比誤抓高太多。教師端做出「已關懷、可清除」之前，它就是黏的。
 *    needs_followup 的條件含 depression_critical === true，會自動跟著黏住。
 *
 * 用資料庫現值而不是畫面上的狀態，是為了讓學生同時開兩個分頁也不會漏掉。
 */
export async function saveSelfcheck(
  email: string, semester: string, patch: SelfcheckPatch,
): Promise<HealthSelfcheck> {
  const prev = await getSelfcheck(email, semester)

  const row: Record<string, unknown> = {
    student_email: email, semester, ...patch,
  }

  if ('depression_critical' in patch) {
    row.depression_critical = prev?.depression_critical === true || patch.depression_critical === true
  }

  row.needs_followup = computeFollowup({
    mood_scale: 'mood_scale' in patch ? patch.mood_scale : prev?.mood_scale,
    stress_level: 'stress_level' in patch ? patch.stress_level : prev?.stress_level,
    depression: 'depression' in patch ? patch.depression : prev?.depression,
    depression_critical:
      (row.depression_critical as boolean | undefined) ?? prev?.depression_critical,
  })

  return unwrap(
    await supabase
      .from('hc_health_selfcheck')
      .upsert(row, { onConflict: 'student_email,semester' })
      .select()
      .single(),
  )
}

/* ------------------------------------------------------- 教師端紅旗查詢（唯讀） */

/** 觸發紅旗的單一項目 */
export interface FlagReason {
  /** 量表名稱，例：心情溫度計 */
  scale: string
  /** 說明，例：12 分（中度以上） */
  detail: string
}

export interface FlaggedStudent {
  student_email: string
  semester: string
  /** 對不到名單時為 null，畫面退回顯示 email */
  name: string | null
  class_name: string | null
  seat_no: number | null
  /** critical 為第 20 題勾選，優先於分數高 */
  level: 'critical' | 'score'
  reasons: FlagReason[]
  updated_at: string
}

/** 紅旗規則的文字說明，與 computeFollowup 的門檻一致 */
function reasonsOf(row: HealthSelfcheck): FlagReason[] {
  const out: FlagReason[] = []
  if (row.depression_critical) {
    out.push({ scale: '情緒自我檢視表', detail: '第 20 題「我想要消失不見」勾選' })
  }
  if ((row.mood_scale ?? -1) >= 10) {
    out.push({ scale: '心情溫度計', detail: `${row.mood_scale} 分（中度以上）` })
  }
  if ((row.stress_level ?? -1) >= 6) {
    out.push({ scale: '壓力偵測站', detail: `${row.stress_level} 項` })
  }
  if ((row.depression ?? -1) >= 12) {
    out.push({ scale: '情緒自我檢視表', detail: `${row.depression} 分` })
  }
  return out
}

/**
 * 這學期需要關心的學生。
 *
 * 只讀，不寫。RLS 已經把範圍限制在「自己教的班」（hc_teaches_student_email），
 * 這裡不再自己做一次權限判斷，避免兩套規則各說各話。
 *
 * 姓名班級座號另外查 hc_students 再於前端比對，不是為了省事：
 * hc_health_selfcheck 只存 student_email，兩張表之間沒有外鍵可以讓
 * PostgREST 直接 embed，而這一頁刻意不新增 migration。
 * 比對的鍵是 coalesce(login_email, email)，與 hc_my_student_profile
 * 和 RLS 判斷用的值同一個，換過登入信箱的學生才不會對不上。
 */
export async function listFlagged(semesters: string[]): Promise<FlaggedStudent[]> {
  if (semesters.length === 0) return []

  const rows = unwrap<HealthSelfcheck[]>(
    await supabase
      .from('hc_health_selfcheck')
      .select('*')
      .eq('needs_followup', true)
      .in('semester', semesters)
      .order('updated_at', { ascending: false }),
  )
  if (rows.length === 0) return []

  const emails = [...new Set(rows.map((r) => r.student_email))]
  const roster = unwrap<
    { name: string; seat_no: number | null; email: string; login_email: string | null;
      class_id: string }[]
  >(
    await supabase
      .from('hc_students')
      .select('name, seat_no, email, login_email, class_id')
      .or(`email.in.(${emails.join(',')}),login_email.in.(${emails.join(',')})`),
  )

  const classIds = [...new Set(roster.map((s) => s.class_id))]
  const classes = classIds.length === 0 ? [] : unwrap<{ id: string; name: string }[]>(
    await supabase.from('hc_classes').select('id, name').in('id', classIds),
  )
  const classNameOf = new Map(classes.map((c) => [c.id, c.name]))

  const byEmail = new Map(roster.map((s) => [s.login_email ?? s.email, s]))

  return rows
    .map((r): FlaggedStudent => {
      const s = byEmail.get(r.student_email)
      return {
        student_email: r.student_email,
        semester: r.semester,
        name: s?.name ?? null,
        class_name: s ? classNameOf.get(s.class_id) ?? null : null,
        seat_no: s?.seat_no ?? null,
        level: r.depression_critical ? 'critical' : 'score',
        reasons: reasonsOf(r),
        updated_at: r.updated_at,
      }
    })
    // depression_critical 排最前面，其餘照更新時間新到舊
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === 'critical' ? -1 : 1
      return b.updated_at.localeCompare(a.updated_at)
    })
}
