/**
 * 記住「按登入之前本來要去哪一頁」，登入回來後導回去。
 *
 * 為什麼需要：OAuth 的 redirectTo 是 origin + pathname，pathname 不含 hash，
 * 所以掃 QR code 進 #/health 的學生登入完會掉到根路徑。
 *
 * 為什麼不直接把 hash 放進 redirectTo：這個專案用 PKCE，Supabase 是把
 * ?code= 接在 redirect_to 後面。redirect_to 若已經有 hash，code 會被接進
 * hash 裡變成 #/health?code=xxx，auth-js 的 parseParametersFromURL 會把它
 * 解析成一個叫 "/health?code" 的鍵，拿不到 code —— 登入會靜靜地失敗。
 * 所以 redirectTo 一個字都不動，改用這裡存。
 */

const KEY = 'hc_pending_route'
/** 超過這個時間就不算數，避免按了登入卻放棄的人下次被莫名其妙導走 */
const TTL_MS = 10 * 60 * 1000

/**
 * 只接受 /health 底下的路徑。
 * 這正是掃 QR code 的情境，也是唯一「預設落點會落錯」的情境；
 * 限制範圍就不會因為存了奇怪的值把人導到意料之外的地方。
 */
const allowed = (path: string) => path === '/health' || path.startsWith('/health/')

/**
 * 按下登入之前呼叫。
 *
 * iOS Safari 無痕模式寫 sessionStorage 會丟例外，這裡一定要接住 ——
 * 沒接住的話整顆登入按鈕會壞掉，而學生用手機，一定有人開無痕。
 * 存不進去就當作沒存，登入流程照舊。
 */
export function rememberRoute(hash: string): void {
  try {
    const path = hash.startsWith('#') ? hash.slice(1) : hash
    if (!allowed(path)) return
    sessionStorage.setItem(KEY, JSON.stringify({ path, ts: Date.now() }))
  } catch {
    // 無痕模式或使用者關掉了儲存空間：放棄記錄，不要影響登入
  }
}

/** 登入完成後呼叫；回傳要導去的路徑，沒有就是 null。讀完即清除 */
export function consumeRoute(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const { path, ts } = JSON.parse(raw) as { path?: unknown; ts?: unknown }
    if (typeof path !== 'string' || typeof ts !== 'number') return null
    if (Date.now() - ts > TTL_MS) return null
    return allowed(path) ? path : null
  } catch {
    return null
  }
}
