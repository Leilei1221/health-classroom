import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureTeacher, findTeacher } from './lib/api'
import { myStudentProfile } from './health/api'
import type { StudentProfile, Teacher } from './lib/types'

/** 學校 Google Workspace 網域，用於登入畫面的帳號提示 */
const SCHOOL_DOMAIN = 'hlhs.hlc.edu.tw'

export type Role = 'resolving' | 'teacher' | 'student' | 'unknown'

interface AuthState {
  session: Session | null
  teacher: Teacher | null
  student: StudentProfile | null
  role: Role
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [role, setRole] = useState<Role>('resolving')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  /**
   * 判定登入者身分。
   *
   * 順序：現有教師檔案 → 學生名單 → 建立教師檔案。三段都有理由：
   *
   * 1. 先查「現有的」教師檔案，而且是唯讀的 findTeacher()。
   *    已經是老師的人不該因為名字出現在某張名單上就被降成學生 ——
   *    老師會把自己掛進測試班級（hc_students.login_email）實測學生流程，
   *    那時 student 與 teacher 會同時存在，教師後台不能因此消失。
   * 2. 再查學生名單。
   * 3. 兩者皆無才呼叫 hc_ensure_teacher() 建立教師檔案。順序不能往前挪：
   *    它對任何登入者都會建立教師列，若無條件呼叫，學生一登入就會被建成教師。
   *
   * student 不論身分都會保留，健康頁靠它決定要顯示登記表單還是說明卡。
   * 查詢失敗時退回教師流程，維持健康模組上線前的既有行為。
   */
  useEffect(() => {
    if (!session) {
      setTeacher(null); setStudent(null); setRole('unknown')
      return
    }
    let cancelled = false
    setRole('resolving')

    ;(async () => {
      let existing: Teacher | null = null
      try {
        existing = await findTeacher(session.user.id)
      } catch (e) {
        console.error('查詢教師檔案失敗', e)
      }

      let profiles: StudentProfile[] = []
      try {
        profiles = await myStudentProfile()
      } catch (e) {
        console.error('查詢學生身分失敗，改以教師流程處理', e)
      }
      if (cancelled) return

      setStudent(profiles[0] ?? null) // 已依學年度學期排序，取最新的一筆

      if (existing) {
        setTeacher(existing)
        setRole('teacher')
        return
      }

      if (profiles.length > 0) {
        setTeacher(null)
        setRole('student')
        return
      }

      try {
        const t = await ensureTeacher()
        if (!cancelled) { setTeacher(t); setRole('teacher') }
      } catch (e) {
        console.error('建立教師檔案失敗', e)
        if (!cancelled) setRole('unknown')
      }
    })()

    return () => { cancelled = true }
  }, [session])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        // hd 只是提示，會讓 Google 優先顯示學校帳號；真正的限制在
        // OAuth 同意畫面的「內部」設定與資料庫 RLS，不能只靠這個參數
        queryParams: { hd: SCHOOL_DOMAIN },
      },
    })
    if (error) throw error
  }

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <Ctx.Provider
      value={{ session, teacher, student, role, loading, signInWithGoogle, signOut }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth 必須在 AuthProvider 內使用')
  return v
}
