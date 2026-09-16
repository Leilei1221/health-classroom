/**
 * 登入狀態要存在哪裡。
 *
 * 用 sessionStorage 而不是 supabase 預設的 localStorage：這些平板是共用的，
 * 會在同一節課裡傳給不同班的學生。存在 sessionStorage 的話「關掉分頁」
 * 就等於登出，不必依賴學生記得按按鈕。
 *
 * 同一個分頁重新整理仍然保留，OAuth 往返（本站 → Google → 本站）也是
 * 同一個分頁的頂層導航，所以 PKCE 的 code verifier 不會在中途弄丟。
 *
 * 代價：開新分頁要重新登入。學生端沒有會開新分頁的連結（分頁列與頁內
 * 連結都是同分頁導航），教師端則是關掉瀏覽器後要重登一次。
 *
 * iOS 無痕模式連「存取」sessionStorage 都會丟例外，所以不能直接把
 * window.sessionStorage 交給 supabase——那會在模組載入時就炸掉整個網站。
 * 這裡一律包一層，取不到就退回記憶體：當下這一次仍然能用完，
 * 只是重新整理會掉，總比整頁白掉好。
 */

const memory = new Map<string, string>()

/** 實際探測一次讀寫，不能只看 typeof：無痕模式是「有這個物件但一寫就爆」 */
function probe(): Storage | null {
  try {
    const s = globalThis.sessionStorage
    if (!s) return null
    const k = '__hc_probe__'
    s.setItem(k, '1')
    s.removeItem(k)
    return s
  } catch {
    return null
  }
}

const store = probe()

/** 交給 supabase createClient 的 auth.storage */
export const authStorage = {
  getItem: (key: string): string | null => {
    try {
      return store ? store.getItem(key) : memory.get(key) ?? null
    } catch {
      return memory.get(key) ?? null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (store) store.setItem(key, value)
      else memory.set(key, value)
    } catch {
      memory.set(key, value)
    }
  },
  removeItem: (key: string): void => {
    try {
      if (store) store.removeItem(key)
      else memory.delete(key)
    } catch {
      memory.delete(key)
    }
  },
}

/**
 * 清掉 localStorage 裡殘留的舊登入狀態。
 *
 * 改用 sessionStorage 之前，session 是存在 localStorage 的，
 * 現在每一台平板上都還躺著之前那些學生的 session。程式已經不會去讀它們，
 * 但留著就是把上一位的 token 留在共用裝置上，沒有理由。
 * 開站時掃一次，只動 localStorage，不要碰現在正在用的 sessionStorage。
 */
export function purgeStaleLocalAuth(): void {
  try {
    const s = globalThis.localStorage
    if (!s) return
    const doomed: string[] = []
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i)
      if (k && k.startsWith('sb-')) doomed.push(k)
    }
    for (const k of doomed) {
      try { s.removeItem(k) } catch { /* 個別刪不掉就算了 */ }
    }
  } catch {
    // 無痕模式：本來就沒東西留下
  }
}
