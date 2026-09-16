import { createClient } from '@supabase/supabase-js'
import { authStorage, purgeStaleLocalAuth } from './authStorage'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，請檢查 .env 設定')
}

// 建立 client 之前先把舊版留在 localStorage 的 session 掃掉（見 authStorage.ts）
purgeStaleLocalAuth()

export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    // 共用平板：關掉分頁就等於登出，不把身分留給下一位同學
    storage: authStorage,
  },
})
