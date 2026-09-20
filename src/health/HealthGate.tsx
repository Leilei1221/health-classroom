import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { Spinner } from '../components/ui'
import { healthEnabledForMe } from './api'
import HealthRegister from './HealthRegister'
import SelfCheck from './selfcheck/SelfCheck'
import Plate from './plate/Plate'
import FlagList from './teacher/FlagList'
import Progress from './teacher/Progress'
import Detail from './teacher/Detail'
import { PREVIEW_STUDENT } from './preview'
import type { StudentProfile } from '../lib/types'

export type HealthPage = 'register' | 'selfcheck' | 'plate' | 'teacher' | 'progress' | 'detail'

/** 學生填寫的三個頁面；教師查詢頁走另一條路，不在這裡 */
const PAGES: Record<Exclude<HealthPage, 'teacher' | 'progress' | 'detail'>, (p?: StudentProfile) => JSX.Element> = {
  register: (p) => <HealthRegister preview={p} />,
  selfcheck: (p) => <SelfCheck preview={p} />,
  plate: (p) => <Plate preview={p} />,
}

const PAGE_NAMES: Record<Exclude<HealthPage, 'teacher' | 'progress' | 'detail'>, string> = {
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

  /*
    白名單：只有指定的班級用得到健康模組（基礎急救概論是多元選修、
    上的是急救；測試班也不該讓 QR code 對它生效）。
    學生讀不到 hc_classes，所以要問資料庫。undefined＝還在問。

    只有學生身分需要問。教師端三頁走的是另一條路，用帶哪些班判斷。
  */
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!session || !student) { setEnabled(undefined); return }
    let cancelled = false
    healthEnabledForMe()
      // 問不到時不要把學生擋在外面：讓他進去，真正擋寫入的是資料庫那層
      .then((v) => { if (!cancelled) setEnabled(v) })
      .catch(() => { if (!cancelled) setEnabled(true) })
    return () => { cancelled = true }
  }, [session, student])

  if (loading || (session && role === 'resolving')) return <Spinner />

  if (!session) return <SignIn onSignIn={signInWithGoogle} />

  /*
    教師查詢頁的身分判斷方向與學生頁相反，不能走下面那段。
    老師會把自己掛進測試班級，student 與 teacher 同時成立，
    若照學生頁的順序判斷，她自己就會被擋在紅旗頁外面。
    實際擋人的條件（有沒有帶班級）在 FlagList 裡，與 RLS 同一套。
  */
  if (page === 'teacher') return <FlagList />
  if (page === 'progress') return <Progress />
  if (page === 'detail') return <Detail />

  // 名單上有這個人就顯示真正的登記表單，不看是學生還是老師 ——
  // 老師把自己掛進測試班級實測時，兩種身分會同時成立
  if (student) {
    if (enabled === undefined) return <Spinner />
    if (!enabled) {
      return (
        <Notice
          title="這個班沒有使用健康管理"
          body={`${student.class_name} 這門課沒有開健康管理單元，所以沒有東西要填。如果你覺得這是弄錯了，請跟老師說一聲。`}
          onSignOut={signOut}
        />
      )
    }
    return PAGES[page]()
  }

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
