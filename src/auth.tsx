import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureTeacher } from './lib/api'
import type { Teacher } from './lib/types'

interface AuthState {
  session: Session | null
  teacher: Teacher | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // 教師檔案採延遲建立：登入後才呼叫 RPC 建檔，避免在共用的 auth.users 掛 trigger
  useEffect(() => {
    if (!session) { setTeacher(null); return }
    let cancelled = false
    ensureTeacher()
      .then((t) => { if (!cancelled) setTeacher(t) })
      .catch((e) => console.error('建立教師檔案失敗', e))
    return () => { cancelled = true }
  }, [session])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (error) throw error
  }

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <Ctx.Provider value={{ session, teacher, loading, signInWithGoogle, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth 必須在 AuthProvider 內使用')
  return v
}
