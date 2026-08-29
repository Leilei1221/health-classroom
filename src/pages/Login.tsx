import { useState } from 'react'
import { useAuth } from '../auth'
import { Button, ErrorBox } from '../components/ui'
import { friendlyError } from '../lib/errors'

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true); setError('')
    try { await signInWithGoogle() } catch (e) { setError(friendlyError(e)); setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">健護課教室管理系統</h1>
          <p className="text-sm text-slate-500">國立花蓮高級中學</p>
        </div>
        {error && <ErrorBox message={error} />}
        <Button onClick={go} disabled={busy} className="w-full justify-center">
          {busy ? '前往 Google 登入…' : '使用 Google 帳號登入'}
        </Button>
        <p className="text-center text-xs text-slate-400">請使用學校的 Google 帳號登入</p>
      </div>
    </div>
  )
}
