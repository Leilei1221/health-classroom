import { useAuth } from '../auth'
import { Spinner } from '../components/ui'
import HealthRegister from './HealthRegister'
import SelfCheck from './selfcheck/SelfCheck'
import Plate from './plate/Plate'
import FlagList from './teacher/FlagList'
import { PREVIEW_STUDENT } from './preview'
import type { StudentProfile } from '../lib/types'

export type HealthPage = 'register' | 'selfcheck' | 'plate' | 'teacher'

/** 學生填寫的三個頁面；教師查詢頁走另一條路，不在這裡 */
const PAGES: Record<Exclude<HealthPage, 'teacher'>, (p?: StudentProfile) => JSX.Element> = {
  register: (p) => <HealthRegister preview={p} />,
  selfcheck: (p) => <SelfCheck preview={p} />,
  plate: (p) => <Plate preview={p} />,
}

const PAGE_NAMES: Record<Exclude<HealthPage, 'teacher'>, string> = {
  register: '身體數值登記',
  selfcheck: '課本自我檢測',
  plate: '我的餐盤',
}

/**
 * 健康管理頁的入口：未登入顯示登入畫面，登入後依身分分流。
 * 只有這條路由需要登入；座位登記與點名維持免登入。
 */
export default function HealthGate({ page = 'register', preview = false }: {
  page?: HealthPage
  preview?: boolean
}) {
  const { session, role, loading, signInWithGoogle, signOut, teacher, student } = useAuth()

  if (loading || (session && role === 'resolving')) return <Spinner />

  if (!session) return <SignIn onSignIn={signInWithGoogle} />

  /*
    教師查詢頁的身分判斷方向與學生頁相反，不能走下面那段。
    老師會把自己掛進測試班級，student 與 teacher 同時成立，
    若照學生頁的順序判斷，她自己就會被擋在紅旗頁外面。
    實際擋人的條件（有沒有帶班級）在 FlagList 裡，與 RLS 同一套。
  */
  if (page === 'teacher') return <FlagList />

  // 名單上有這個人就顯示真正的登記表單，不看是學生還是老師 ——
  // 老師把自己掛進測試班級實測時，兩種身分會同時成立
  if (student) return PAGES[page]()

  // 教師預覽：看得到學生的畫面，但填的東西不會寫進資料庫
  if (preview && role === 'teacher') return PAGES[page](PREVIEW_STUDENT)

  // 老師登入健康頁：第一版還沒有教師看板，先說清楚而不是丟一個空白畫面
  return (
    <Notice
      title={role === 'teacher' ? '這是學生填寫的頁面' : '這個帳號不在名單上'}
      body={
        role === 'teacher'
          ? `你目前以教師身分登入${teacher?.display_name ? `（${teacher.display_name}）` : ''}。${PAGE_NAMES[page]}由學生自己填寫，教師端的進度看板還在製作中。想看學生填寫的畫面，可以從班級列表按「以學生身分預覽」。`
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
