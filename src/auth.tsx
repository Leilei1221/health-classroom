import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureTeacher } from './lib/api'
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
   * 先查學生名單再決定要不要建教師檔案 —— 順序不能顛倒：
   * hc_ensure_teacher() 對任何登入者都會建立教師列，若無條件呼叫，
   * 學生一登入就會被建成教師。
   *
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
      let profiles: StudentProfile[] = []
      try {
        profiles = await myStudentProfile()
      } catch (e) {
        console.error('查詢學生身分失敗，改以教師流程處理', e)
      }
      if (cancelled) return

      if (profiles.length > 0) {
        setStudent(profiles[0]) // 已依學年度學期排序，取最新的一筆
        setTeacher(null)
        setRole('student')
        return
      }

      try {
        const t = await ensureTeacher()
        if (!cancelled) { setTeacher(t); setStudent(null); setRole('teacher') }
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
