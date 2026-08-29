import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 會部署到 https://<user>.github.io/<repo>/，因此需要設定 base。
// 若改用自訂網域或部署到根目錄，把 VITE_BASE 設為 '/' 即可。
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/health-classroom/',
})
