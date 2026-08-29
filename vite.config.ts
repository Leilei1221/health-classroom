import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 會部署到 https://<user>.github.io/<repo>/，因此需要設定 base。
// 若改用自訂網域或部署到根目錄，把 VITE_BASE 設為 '/' 即可。
const DEFAULT_BASE = '/health-classroom/'

export default defineConfig(({ mode }) => {
  // CI 上若把未設定的 repo variable 帶入 env（例：${{ vars.FOO }}），
  // 會變成「空字串」並覆蓋 .env 中的值，導致建置出一份沒有 Supabase 設定、
  // 一開啟就白畫面的 bundle。空字串一律視為未設定。
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('VITE_') && process.env[key]?.trim() === '') {
      delete process.env[key]
    }
  }

  const env = loadEnv(mode, process.cwd(), '')

  // 寧可讓建置失敗，也不要把壞掉的網站部署出去
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !env[k]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `建置中止：缺少必要的環境變數 ${missing.join('、')}。\n` +
        `請確認 .env 檔存在，或在 CI 設定對應的環境變數。`,
    )
  }

  return {
    plugins: [react()],
    base: process.env.VITE_BASE ?? DEFAULT_BASE,
  }
})
