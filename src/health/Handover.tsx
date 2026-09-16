import { useState } from 'react'
import { useAuth } from '../auth'
import { GOOGLE_LOGOUT_URL, wipeLocalAuthState } from '../lib/handover'

/**
 * 共用平板用的「換下一位同學」。
 *
 * 平板會在同一節課裡傳給不同班的學生，所以這顆按鈕要夠顯眼——
 * 頁首那個灰色小字「登出」沒有人會按，上一位的答案就留在畫面上給下一位看。
 *
 * 按下去會做三件事：清掉本站的登入狀態、把 Google 帳號也登出、離開本站。
 * Google 登出後不會自動回來（Google 擋掉外部網域的 continue），
 * 下一位重新掃 QR code 進來就好。
 */
export default function Handover() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const handOver = async () => {
    setBusy(true)
    // 登出的網路請求失敗也要繼續走完，不能把上一位的 session 留在平板上
    try { await signOut() } catch { /* 下一行會把本機那份清掉 */ }
    wipeLocalAuthState()
    window.location.assign(GOOGLE_LOGOUT_URL)
  }

  return (
    <section className="mx-3 my-4 overflow-hidden rounded-2xl border-[1.5px] border-[#C7E2DC] bg-white">
      <div className="px-4 pb-3 pt-3.5">
        <h3 className="text-[15.5px] font-bold">填好了嗎？換下一位同學之前請按這裡</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4A6461]">
          這台平板是大家輪流用的。不按的話，下一位同學打開網頁會直接看到你的資料，
          也能用你的帳號繼續填。
        </p>
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={() => void handOver()}
          disabled={busy}
          className="w-full rounded-xl bg-[#B26A12] py-4 text-[17px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#D3B48A]"
        >
          {busy ? '登出中…' : '我填好了，換下一位同學'}
        </button>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-[#4A6461]">
          會一併登出這台平板上的 Google 帳號，登出後畫面會停在 Google。
          <br />
          下一位同學重新掃 QR code 就可以開始。
        </p>
      </div>
    </section>
  )
}
