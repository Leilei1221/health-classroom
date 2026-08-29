/** 資料庫 RPC 以 raise exception 回傳的錯誤代碼，對應成中文訊息 */
const MESSAGES: Record<string, string> = {
  invalid_code: '這個連結無效，請跟老師確認選位連結是否正確。',
  picking_closed: '老師目前尚未開放選位，請稍候。',
  invalid_student: '找不到你的資料，請跟老師確認名單。',
  student_no_mismatch: '學號後三碼不正確，請再確認一次。',
  seat_out_of_range: '這個位子不在座位圖範圍內。',
  seat_disabled: '這個位子不開放選取。',
  seat_taken: '這個位子剛剛被別人選走了，請換一個。',
  not_authenticated: '請先登入。',
}

/** 連線失敗時瀏覽器丟出的訊息，對學生而言毫無意義，需另外轉譯 */
const NETWORK_HINTS = ['Failed to fetch', 'NetworkError', 'Load failed', 'ERR_NETWORK', 'ERR_INTERNET']

export function friendlyError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : (err as { message?: string } | null)?.message ?? ''

  for (const [code, msg] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return msg
  }
  if (NETWORK_HINTS.some((h) => raw.includes(h))) {
    return '連不上伺服器，請確認網路連線後再試一次。'
  }
  return raw || '發生未預期的錯誤，請稍後再試。'
}
