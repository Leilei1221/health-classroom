import { supabase } from '../lib/supabase'
import { listClasses } from '../lib/api'
import { riskLevel } from './riskLevel'
import type {
  ClassRow, HealthCheckin, HealthGoal, HealthMeasurement, HealthSelfcheck, MeasurementRound, StudentProfile,
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

/**
 * 我的班有沒有開健康模組（白名單）。
 *
 * 學生讀不到 hc_classes，所以這件事只能問資料庫。回來的是一個布林值，
 * 不是班級資料——這支函式的用途只有「要不要顯示健康模組」。
 *
 * 前端擋是為了不讓學生看到一個填不了的表單；真正擋住寫入的是
 * hc_is_known_student_email()，兩張健康表的 WITH CHECK 都走它。
 */
export async function healthEnabledForMe(): Promise<boolean> {
  const { data, error } = await supabase.rpc('hc_health_enabled_for_me')
  if (error) throw error
  return data === true
}

/** 學年度學期組成資料表用的 semester 字串 */
export const semesterKey = (p: StudentProfile) => `${p.academic_year}-${p.semester}`

/**
 * 第一版只做期初；期中／期末沿用同一頁，改這個常數即可。
 * 登記頁與進度表共用，兩邊不會各說各話。
 */
export const ROUND: MeasurementRound = 'initial'

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

  const merged = {
    mood_scale: 'mood_scale' in patch ? patch.mood_scale : prev?.mood_scale,
    stress_level: 'stress_level' in patch ? patch.stress_level : prev?.stress_level,
    depression: 'depression' in patch ? patch.depression : prev?.depression,
    depression_critical:
      (row.depression_critical as boolean | undefined) ?? prev?.depression_critical,
  }
  row.needs_followup = computeFollowup(merged)

  /*
    紅旗等級：規格書第五節明定「由送出時即時計算後寫入，不是查詢時現算——
    這是要留紀錄的判定，不是可變的呈現」。所以算好一起 upsert。

    risk_flagged_at 記「第一次被標記」與「升級」的時間：
    升級代表情況變了，那個時間點對教師端有意義；同級重測則不覆蓋，
    否則學生每重做一次，教師端看到的觸發時間就往後跳一次。
  */
  const level = riskLevel({
    mood: merged.mood_scale ?? null,
    stress: merged.stress_level ?? null,
    depression: merged.depression ?? null,
    depressionCritical: merged.depression_critical === true,
  })
  row.risk_level = level
  if (level > 0 && (!prev?.risk_flagged_at || level > (prev?.risk_level ?? 0))) {
    row.risk_flagged_at = new Date().toISOString()
  }
  // 學生作答的時間，與教師標記已聯繫造成的 updated_at 分開
  row.answered_at = new Date().toISOString()

  return unwrap(
    await supabase
      .from('hc_health_selfcheck')
      .upsert(row, { onConflict: 'student_email,semester' })
      .select()
      .single(),
  )
}

/**
 * 授課教師的姓名，給關懷文案用（規格書第五節：不要寫死）。
 *
 * 只回姓名一個字串，沒有 email、沒有 id——這支 RPC 是開給全校學生呼叫的，
 * 多回傳一個欄位就是多一個外洩面。拿不到時回 null，文案會退成「老師」。
 */
export async function myTeacherName(): Promise<string | null> {
  const { data, error } = await supabase.rpc('hc_my_teacher_name')
  if (error) throw error
  return typeof data === 'string' && data.trim() !== '' ? data : null
}

/** 班級統計可以接受的量表；與資料庫函式的白名單一致 */
export type TallyScale = 'lifestyle' | 'h85210' | 'stress' | 'depression' | 'mood'

/**
 * 把這一份作答累加進班級統計（匿名，不綁個人）。
 *
 * 失敗不要讓學生的送出跟著失敗——統計是課堂討論用的，
 * 掉一筆不影響任何人的權益，但擋住送出會。
 */
export async function tallySubmit(
  semester: string, scale: TallyScale, answers: number[],
): Promise<void> {
  try {
    await supabase.rpc('hc_health_tally_submit', {
      p_semester: semester, p_scale: scale, p_answers: answers,
    })
  } catch { /* 統計失敗不影響作答 */ }
}

/* ------------------------------------------------------------ SMART 目標 */

export async function getHealthGoal(
  email: string, semester: string, goalNo = 1,
): Promise<HealthGoal | null> {
  const { data, error } = await supabase
    .from('hc_health_goal')
    .select('*')
    .eq('student_email', email)
    .eq('semester', semester)
    .eq('goal_no', goalNo)
    .maybeSingle()
  if (error) throw error
  return data as HealthGoal | null
}

export type HealthGoalPatch = Partial<Omit<
  HealthGoal,
  'id' | 'created_at' | 'updated_at'
>> & {
  student_email: string
  semester: string
  goal_no: number
}

export async function saveHealthGoal(row: HealthGoalPatch): Promise<HealthGoal> {
  return unwrap(
    await supabase
      .from('hc_health_goal')
      .upsert(row, { onConflict: 'student_email,semester,goal_no' })
      .select()
      .single(),
  )
}

/* ------------------------------------------------------------ 四週打卡 */

export async function listHealthCheckins(
  email: string, semester: string, weekNo = 1,
): Promise<HealthCheckin[]> {
  const { data, error } = await supabase
    .from('hc_health_checkin')
    .select('*')
    .eq('student_email', email)
    .eq('semester', semester)
    .eq('week_no', weekNo)
    .order('day_no', { ascending: true })
  if (error) throw error
  return (data ?? []) as HealthCheckin[]
}

export type HealthCheckinPatch = Partial<Omit<
  HealthCheckin,
  'id' | 'created_at' | 'updated_at'
>> & {
  goal_id: string
  student_email: string
  semester: string
  week_no: number
  day_no: number
}

export async function saveHealthCheckin(row: HealthCheckinPatch): Promise<HealthCheckin> {
  return unwrap(
    await supabase
      .from('hc_health_checkin')
      .upsert(row, { onConflict: 'goal_id,week_no,day_no' })
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

/* ------------------------------------------------- 教師端班級進度表（唯讀） */

/** 進度表的九個欄位，順序即畫面上的欄位順序 */
export const PROGRESS_TASKS = [
  { key: 'measurement', label: '身體數值登記', short: '登記' },
  { key: 'lifestyle', label: '生活型態', short: '生活' },
  { key: 'h85210', label: '85210', short: '85210' },
  { key: 'pyramid', label: '飲食金字塔', short: '金字塔' },
  { key: 'sleep', label: '睡眠檢測', short: '睡眠' },
  { key: 'mood', label: '心情溫度計', short: '心情' },
  { key: 'stress', label: '壓力偵測站', short: '壓力' },
  { key: 'depression', label: '情緒自我檢視表', short: '情緒' },
  { key: 'plate', label: '我的餐盤', short: '餐盤' },
] as const

export type TaskKey = (typeof PROGRESS_TASKS)[number]['key']

/** 摘要說的「七份」＝七份量表，不含身體數值登記與餐盤活動 */
export const SCALE_TASK_KEYS: TaskKey[] = [
  'lifestyle', 'h85210', 'pyramid', 'sleep', 'mood', 'stress', 'depression',
]

export interface ProgressStudent {
  student_id: string
  class_id: string
  seat_no: number | null
  name: string
  done: Record<TaskKey, boolean>
  /** 七份量表完成幾份 */
  scalesDone: number
  /** 還沒做的量表名稱，手機版用 */
  missing: string[]
}

/**
 * 班級進度：每個學生每一份「做了沒」。
 *
 * 這一頁會投影給全班看，所以**分數不能進到瀏覽器**——不是「查回來但不顯示」，
 * 是根本不查。下面每一條查詢都只 select('student_email')，
 * 「做了沒」交給 where 條件判斷（欄位 is not null），
 * 分數、三燈區題號、85210 勾了哪幾項，一個位元組都不會離開資料庫。
 * 想在這一頁顯示分數也顯示不出來，因為手上沒有。
 *
 * 以班級名單為底左外接答題資料，不是反過來：完全沒做過的人在
 * hc_health_selfcheck 裡一列都沒有，從答題資料撈會整個漏掉，
 * 而那正是最需要看到的人。
 */
export async function listProgress(semesters: string[]): Promise<ProgressStudent[]> {
  const roster = unwrap<
    { id: string; class_id: string; seat_no: number | null; name: string;
      email: string; login_email: string | null }[]
  >(
    await supabase
      .from('hc_students')
      .select('id, class_id, seat_no, name, email, login_email')
      .eq('is_active', true)
      .order('seat_no', { ascending: true, nullsFirst: false }),
  )
  if (semesters.length === 0) return []

  const sc = () =>
    supabase.from('hc_health_selfcheck').select('student_email').in('semester', semesters)
  const emails = (rows: { student_email: string }[]) =>
    new Set(rows.map((r) => r.student_email))

  // 九條查詢平行送，每一條都只要 email 清單
  const [measurement, lifestyle, h85210, pyramid, sleep, mood, stress, depression, plate] =
    await Promise.all([
      supabase.from('hc_health_measurement').select('student_email')
        .in('semester', semesters).eq('round', ROUND),
      sc().not('lifestyle', 'is', null),
      // h85210 是 NOT NULL 預設 '{}'，不能用 is null 判斷；
      // 有送出過就一定寫滿七個 key，所以檢查其中一個 key 在不在
      sc().not('h85210->>sleep8', 'is', null),
      sc().not('diet_type', 'is', null),
      sc().not('sleep_isi', 'is', null),
      sc().not('mood_scale', 'is', null),
      sc().not('stress_level', 'is', null),
      sc().not('depression', 'is', null),
      sc().not('plate', 'is', null),
    ])

  const sets: Record<TaskKey, Set<string>> = {
    measurement: emails(unwrap(measurement)),
    lifestyle: emails(unwrap(lifestyle)),
    h85210: emails(unwrap(h85210)),
    pyramid: emails(unwrap(pyramid)),
    sleep: emails(unwrap(sleep)),
    mood: emails(unwrap(mood)),
    stress: emails(unwrap(stress)),
    depression: emails(unwrap(depression)),
    plate: emails(unwrap(plate)),
  }

  return roster.map((s) => {
    // 與 hc_my_student_profile 和 RLS 判斷用的是同一個值
    const account = s.login_email ?? s.email
    const done = {} as Record<TaskKey, boolean>
    for (const t of PROGRESS_TASKS) done[t.key] = sets[t.key].has(account)
    const missing = PROGRESS_TASKS
      .filter((t) => SCALE_TASK_KEYS.includes(t.key) && !done[t.key])
      .map((t) => t.label)
    return {
      student_id: s.id,
      class_id: s.class_id,
      seat_no: s.seat_no,
      name: s.name,
      done,
      scalesDone: SCALE_TASK_KEYS.filter((k) => done[k]).length,
      missing,
    }
  })
}

/* ----------------------------------------------------- 教師端的班級清單 */

export interface HealthClass {
  row: ClassRow
  /** 白名單有沒有開。false＝停用中，但因為有舊資料所以還是列出來 */
  enabled: boolean
}

/**
 * 教師端三頁（紅旗、進度、明細）共用的班級清單。
 *
 * 列出的條件是「白名單有開 **或** 這個班有健康資料」，不是只看白名單。
 * 只看白名單的話，期末把某個班關掉，那個班的資料就從畫面上消失——
 * 老師會以為資料不見了。資料還在，只是被濾掉，這種誤會的代價太高。
 *
 * 判斷「有沒有資料」只查 student_email，沒有把分數撈出來：
 * 班級進度表會投影給全班看，那一頁的鐵則是分數不進瀏覽器，
 * 這個共用函式也得守同一條線。
 */
export async function listHealthClasses(): Promise<HealthClass[]> {
  const classes = (await listClasses()).filter((c) => c.is_active)
  if (classes.length === 0) return []

  const semesters = [...new Set(classes.map((c) => `${c.academic_year}-${c.semester}`))]

  const [ms, scs, roster] = await Promise.all([
    supabase.from('hc_health_measurement').select('student_email').in('semester', semesters),
    supabase.from('hc_health_selfcheck').select('student_email').in('semester', semesters),
    supabase.from('hc_students').select('class_id, email, login_email').eq('is_active', true),
  ])

  const has = new Set<string>([
    ...unwrap<{ student_email: string }[]>(ms).map((r) => r.student_email),
    ...unwrap<{ student_email: string }[]>(scs).map((r) => r.student_email),
  ])
  const withData = new Set<string>()
  for (const s of unwrap<{ class_id: string; email: string; login_email: string | null }[]>(roster)) {
    if (has.has(s.login_email ?? s.email)) withData.add(s.class_id)
  }

  return classes
    .filter((c) => c.health_enabled || withData.has(c.id))
    .map((c) => ({ row: c, enabled: c.health_enabled }))
}

/* --------------------------------------------- 教師端明細檢視（唯讀，不投影） */

export const ROUNDS: { key: MeasurementRound; label: string }[] = [
  { key: 'initial', label: '期初' },
  { key: 'mid', label: '期中' },
  { key: 'final', label: '期末' },
]

export interface DetailStudent {
  student_id: string
  class_id: string
  student_no: string
  seat_no: number | null
  name: string
  /** 與 hc_my_student_profile 和 RLS 判斷用的是同一個值 */
  account: string
  /** 三次測量，沒登記的是 null */
  rounds: Record<MeasurementRound, HealthMeasurement | null>
  selfcheck: HealthSelfcheck | null
}

/**
 * 一個班的完整明細。
 *
 * 只讀，不寫——這一頁沒有任何編輯功能，學生要改資料一律自己回登記頁重送。
 * 讀得到誰由 RLS 決定（教師只能讀自己帶的班），這裡不再自己做一次權限判斷。
 *
 * 與班級進度表 listProgress() 相反：那一頁刻意只查 student_email，
 * 因為會投影給全班看；這一頁是老師自己看的，所以查整列。
 * 兩個函式分開寫就是為了讓這件事在程式碼裡看得出來，不要合併。
 *
 * 一次把整班撈回來（三條查詢），不是點一個學生查一次：
 * 匯出 CSV 和明細用的是同一份資料，畫面上的數字和匯出的檔案不會兜不起來。
 */
export async function listClassDetail(
  classId: string, semester: string,
): Promise<DetailStudent[]> {
  const roster = unwrap<
    { id: string; class_id: string; student_no: string; seat_no: number | null;
      name: string; email: string; login_email: string | null }[]
  >(
    await supabase
      .from('hc_students')
      .select('id, class_id, student_no, seat_no, name, email, login_email')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('seat_no', { ascending: true, nullsFirst: false }),
  )
  if (roster.length === 0) return []

  const accounts = [...new Set(roster.map((s) => s.login_email ?? s.email))]

  const [ms, scs] = await Promise.all([
    supabase.from('hc_health_measurement').select('*')
      .eq('semester', semester).in('student_email', accounts),
    supabase.from('hc_health_selfcheck').select('*')
      .eq('semester', semester).in('student_email', accounts),
  ])

  const byRound = new Map<string, Record<MeasurementRound, HealthMeasurement | null>>()
  for (const m of unwrap<HealthMeasurement[]>(ms)) {
    const slot = byRound.get(m.student_email)
      ?? { initial: null, mid: null, final: null }
    slot[m.round] = m
    byRound.set(m.student_email, slot)
  }
  const scByEmail = new Map(
    unwrap<HealthSelfcheck[]>(scs).map((r) => [r.student_email, r]),
  )

  return roster.map((s): DetailStudent => {
    const account = s.login_email ?? s.email
    return {
      student_id: s.id,
      class_id: s.class_id,
      student_no: s.student_no,
      seat_no: s.seat_no,
      name: s.name,
      account,
      rounds: byRound.get(account) ?? { initial: null, mid: null, final: null },
      selfcheck: scByEmail.get(account) ?? null,
    }
  })
}
