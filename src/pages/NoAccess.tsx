import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Button } from '../components/ui'

/**
 * 登入成功、但不是教師白名單上的帳號。
 *
 * 在白名單上線之前，這種帳號會落到教師後台的空殼（RLS 讓它讀不到任何資料，
 * 所以看到的是一個什麼都沒有的班級管理頁）。那個畫面會讓人以為系統壞了，
 * 也會讓人以為再試幾次就進得去。這一頁把話講清楚。
 *
 * 真正擋住資料的是資料庫：hc_ensure_teacher() 不在白名單就不建教師檔，
 * hc_classes 的 WITH CHECK 也要白名單才插得進去。這一頁只是把結果講出來，
 * 不是防線——把它繞過去也拿不到任何東西。
 */
export default function NoAccess() {
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">這個帳號沒有教師權限</h1>
          {email && (
            <p className="break-all text-sm text-slate-500">
              目前登入的是 <span className="font-mono">{email}</span>
            </p>
          )}
        </div>

        <p className="text-sm leading-relaxed text-slate-600">
          教師端只開放給指定的帳號。如果你是學生，要填的東西在
          <Link to="/health" className="mx-1 font-medium text-slate-900 underline">
            健康登記頁
          </Link>
          ，用同一個 Google 帳號就可以進去。
        </p>

        <p className="text-sm leading-relaxed text-slate-600">
          如果你覺得這是弄錯了，請跟健護老師說一聲。
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void signOut()} className="flex-1 justify-center">
            換一個帳號登入
          </Button>
        </div>
      </div>
    </div>
  )
}
