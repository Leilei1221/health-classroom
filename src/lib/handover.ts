/**
 * 共用平板的「換下一位同學」。
 *
 * 這台平板會在同一節課裡傳給不同班的學生，所以上一位的身分必須真的斷乾淨，
 * 不能只是關掉分頁。要斷的有兩層：
 *
 * 1. 本站的登入狀態：supabase 預設把 session 存在 localStorage
 *    （key 是 sb-<專案>-auth-token），沒登出就一直在，下一位開啟網頁
 *    根本不會經過 Google，直接就是上一位的身分。
 * 2. Google 自己的登入狀態：cookie 在 accounts.google.com，跟本站不同網域。
 *    不把它登出，下一位按登入時 Google 的帳號選擇畫面上仍然列著上一位，
 *    點下去就進得去。
 *
 * 第 2 層只能靠把瀏覽器導到 Google 的登出網址。實測 2026-09-16：
 * https://accounts.google.com/Logout 會 302 到 Google 登入頁；
 * 想用 ?continue= 自動導回本站會被 Google 擋掉（400），
 * 所以沒辦法登出後自動彈回來——下一位重新掃 QR code 進來即可。
 */

export const GOOGLE_LOGOUT_URL = 'https://accounts.google.com/Logout'

/**
 * 把本站在瀏覽器裡留下的登入痕跡清掉。
 *
 * supabase.auth.signOut() 正常情況下就會清掉它自己那一份，這裡是保險：
 * 萬一登出的網路請求失敗，也不能把上一位的 session 留在平板上給下一位。
 * 無痕模式存取 storage 會丟例外，所以每一步都要接住。
 */
export function wipeLocalAuthState(): void {
  for (const store of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      if (!store) continue
      // 用 length/key(i) 而不是 Object.keys()：兩者在瀏覽器上都可行，
      // 但前者是 Storage 的正式介面，行為明確。
      // 邊走邊刪會讓索引跳號，所以先整份掃過挑出要刪的，再一次刪。
      const doomed: string[] = []
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i)
        if (k && (k.startsWith('sb-') || k.startsWith('hc_'))) doomed.push(k)
      }
      for (const k of doomed) {
        try { store.removeItem(k) } catch { /* 個別 key 刪不掉就算了 */ }
      }
    } catch {
      // 無痕模式或使用者關掉了儲存空間：本來就沒東西留下
    }
  }
}
