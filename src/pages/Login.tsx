import { useState } from 'react'
import { useAuth } from '../auth'
import { Button, ErrorBox } from '../components/ui'
import { HeartIcon } from '../components/CuteIcons'
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
    <div className="cute-page">
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 cute-card rounded-3xl p-8">
        <div className="space-y-1 text-center">
          <div className="cute-block mx-auto mb-2 h-[72px] w-[72px] bg-cute-pink"><HeartIcon /></div>
          <h1 className="text-xl font-semibold">健護課教室管理系統</h1>
          <p className="text-sm text-cute-mute">國立花蓮高級中學</p>
        </div>
        {error && <ErrorBox message={error} />}
        <Button onClick={go} disabled={busy} className="w-full justify-center">
          {busy ? '前往 Google 登入…' : '使用 Google 帳號登入'}
        </Button>
        <p className="text-center text-xs text-cute-mute">請使用學校的 Google 帳號登入</p>
      </div>
    </div>
    </div>
  )
}
