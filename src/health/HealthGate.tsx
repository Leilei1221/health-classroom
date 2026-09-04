import { useAuth } from '../auth'
import { Spinner } from '../components/ui'
import HealthRegister from './HealthRegister'

/**
 * 健康管理頁的入口：未登入顯示登入畫面，登入後依身分分流。
 * 只有這條路由需要登入；座位登記與點名維持免登入。
 */
export default function HealthGate() {
  const { session, role, loading, signInWithGoogle, signOut, teacher } = useAuth()

  if (loading || (session && role === 'resolving')) return <Spinner />

  if (!session) return <SignIn onSignIn={signInWithGoogle} />

  if (role === 'student') return <HealthRegister />

  // 老師登入健康頁：第一版還沒有教師看板，先說清楚而不是丟一個空白畫面
  return (
    <Notice
      title={role === 'teacher' ? '這是學生填寫的頁面' : '這個帳號不在名單上'}
      body={
        role === 'teacher'
          ? `你目前以教師身分登入${teacher?.display_name ? `（${teacher.display_name}）` : ''}。健康數值由學生自己填寫，教師端的進度看板還在製作中。`
          : '請確認你是用學校的 Google 帳號登入。如果確定沒錯，可能是名單還沒更新，請跟老師說一聲。'
      }
      onSignOut={signOut}
    />
  )
}

function SignIn({ onSignIn }: { onSignIn: () => Promise<void> }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E9F5F2] p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-[#C7E2DC] bg-white p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-[#0E2E2B]">健康管理・身體數值登記</h1>
          <p className="text-sm text-[#4A6461]">國立花蓮高級中學</p>
        </div>
        <button
          onClick={() => void onSignIn()}
          className="w-full rounded-xl bg-[#12776E] py-4 text-base font-bold text-white"
        >
          用學校 Google 帳號登入
        </button>
        <p className="text-center text-xs text-[#4A6461]">
          請使用學校發的帳號（<span className="font-mono">s學號@hlhs.hlc.edu.tw</span>）
        </p>
      </div>
    </div>
  )
}

function Notice({ title, body, onSignOut }: {
  title: string; body: string; onSignOut: () => Promise<void>
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E9F5F2] p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#C7E2DC] bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-[#0E2E2B]">{title}</h1>
        <p className="text-sm leading-relaxed text-[#4A6461]">{body}</p>
        <button
          onClick={() => void onSignOut()}
          className="w-full rounded-xl border border-[#C7E2DC] py-3 text-sm font-medium text-[#12776E]"
        >
          換一個帳號登入
        </button>
      </div>
    </div>
  )
}
