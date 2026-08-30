# 健護課教室管理系統

國立花蓮高級中學 健康與護理課的課堂管理系統：座位登記、點名、上課表現記錄。

- 前端：React + TypeScript + Vite + Tailwind，部署於 GitHub Pages
- 後端：Supabase（與既有專案共用，所有物件皆以 `hc_` 前綴隔離）

## 功能

| 功能 | 說明 |
|---|---|
| 班級管理 | 依學年度／學期建立班級，設定座位圖尺寸 |
| 學生名單 | 上傳 Excel／CSV（班級、座號、學號、姓名）自動建立班級；也可從 Excel 複製貼上 |
| 分組座位 | 分組 U 字型座位圖（左 2、右 2、後端 1），標準 7 組、308 班 8 組 |
| 座位登記 | 老師端可投影 QR code 讓全班掃描，學生免登入選位；老師可直接點選調位 |
| 點名 | 出席／遲到(-2)／曠課(-5)／請假／公假，一堂課一次儲存 |
| 上課表現 | 加扣分累計制，同一堂課同一學生可記多次 |
| 成績統計 | 出缺席分＋表現分自動加總，可下載 CSV |

## 開發

```bash
npm install
npm run dev
```

連線設定放在 `.env`（可直接沿用 `.env.example`）。
其中的 `VITE_SUPABASE_ANON_KEY` 是 Supabase 的 **publishable key**，
依設計本來就會出現在前端 bundle 中，資料安全靠 RLS 保護，不是祕密。

## 部署

推送到 `main` 後由 `.github/workflows/deploy.yml` 自動建置並發布到 GitHub Pages。
首次部署前需在 repo 的 **Settings → Pages → Source** 選擇 **GitHub Actions**。

若部署到自訂網域或根路徑，把環境變數 `VITE_BASE` 設為 `/` 即可。

## 設定 Google 登入

1. **Google Cloud Console** → 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
   - 已授權的重新導向 URI 填入：
     `https://fcstpyiggvhduaztwlrf.supabase.co/auth/v1/callback`
2. **Supabase Dashboard** → Authentication → Providers → Google
   - 啟用，並填入上一步取得的 Client ID 與 Client Secret
3. **Supabase Dashboard** → Authentication → URL Configuration
   - Site URL 與 Redirect URLs 加入 GitHub Pages 網址
     （例：`https://<帳號>.github.io/health-classroom/`）

## 資料庫

Schema 與說明見 [`docs/schema.md`](docs/schema.md)，
migration 位於 `supabase/migrations/`（已套用至正式專案）。
