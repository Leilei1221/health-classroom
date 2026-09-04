# Google 登入設定步驟（健康管理模組）

只有健康管理的頁面需要登入。**座位登記與點名維持 join_code 免登入流程，不受影響。**

需要在兩個後台各設定一次，順序不能顛倒 —— Supabase 那邊要填的東西，
是 Google Cloud Console 產生出來的。

會用到的兩個網址，先複製起來：

| 用途 | 網址 |
|---|---|
| Supabase 回呼網址 | `https://fcstpyiggvhduaztwlrf.supabase.co/auth/v1/callback` |
| 網站網址 | `https://leilei1221.github.io/health-classroom/` |

---

## 第一部分：Google Cloud Console

網址：<https://console.cloud.google.com/>

用**學校的 Google 帳號**登入（`@hlhs.hlc.edu.tw`）。

### 1-1 建立或選擇專案

左上角專案選單 → **新增專案**。

- 專案名稱：例如「花中健護課系統」
- 位置：如果學校有 Google Workspace 組織，這裡會出現學校的組織名稱，選它

建好之後確認左上角顯示的是這個專案，後面每一步都要在同一個專案底下。

### 1-2 設定 OAuth 同意畫面

左側選單 → **API 和服務** → **OAuth 同意畫面**
（英文介面：APIs & Services → OAuth consent screen）

**User Type（使用者類型）**

- 如果帳號屬於學校的 Google Workspace，選 **內部 / Internal**
  → 這樣只有學校網域的帳號能登入，**這是最乾淨的網域限制方式**
- 如果沒有出現「內部」選項，選 **外部 / External**
  → 網域限制就要另外處理，見下方「關於網域限制」

填寫內容：

| 欄位 | 填什麼 |
|---|---|
| 應用程式名稱 | 花蓮高中健護課系統（學生登入時會看到這個名字） |
| 使用者支援電子郵件 | 你的學校信箱 |
| 應用程式標誌 | 可略過 |
| 應用程式首頁 | `https://leilei1221.github.io/health-classroom/` |
| 授權網域 | `supabase.co` 與 `github.io` |
| 開發人員聯絡資訊 | 你的學校信箱 |

**範圍（Scopes）**：不用另外新增，預設的 `email`、`profile`、`openid` 就夠了。

選 External 的話還有一個「測試使用者」步驟；如果應用程式維持在「測試中」狀態，
只有列在測試使用者裡的帳號能登入（上限 100 人）。要讓全班都能用，
需要把應用程式**發布為正式版**。

### 1-3 建立 OAuth 用戶端 ID

左側選單 → **API 和服務** → **憑證**（Credentials）
→ 上方 **建立憑證** → **OAuth 用戶端 ID**

- **應用程式類型**：選 **網頁應用程式**（Web application）
- **名稱**：例如「健護課網站」

**已授權的 JavaScript 來源**（Authorized JavaScript origins）新增：

```
https://leilei1221.github.io
```

**已授權的重新導向 URI**（Authorized redirect URIs）新增：

```
https://fcstpyiggvhduaztwlrf.supabase.co/auth/v1/callback
```

> 這一格最容易出錯。必須是 **Supabase 的網址**，不是你的網站網址。
> 學生按下登入後，Google 會把人送回 Supabase，再由 Supabase 導回你的網站。
> 少一個字元、多一條斜線都會失敗。

按**建立**，會跳出 **用戶端 ID** 與 **用戶端密鑰** —— 這兩個等一下要用，
先留著視窗或複製到安全的地方。密鑰之後還可以回到憑證頁面再看。

---

## 第二部分：Supabase 後台

網址：<https://supabase.com/dashboard/project/fcstpyiggvhduaztwlrf>

### 2-1 啟用 Google provider

左側 **Authentication** → **Sign In / Providers**（部分版本叫 Providers）
→ 找到 **Google** → 打開開關

| 欄位 | 填什麼 |
|---|---|
| Client ID | 剛才 Google 給的用戶端 ID |
| Client Secret | 剛才 Google 給的用戶端密鑰 |

這一頁通常也會直接顯示 Callback URL，可以跟你填進 Google 的那一條對一次。

按 **Save**。

### 2-2 設定網址

左側 **Authentication** → **URL Configuration**

| 欄位 | 填什麼 |
|---|---|
| Site URL | `https://leilei1221.github.io/health-classroom/` |
| Redirect URLs | 新增 `https://leilei1221.github.io/health-classroom/**` |

Redirect URLs 沒設好的話，登入會成功但轉回來時被擋掉。
結尾的 `/**` 是萬用字元，讓網站底下所有路徑都能當作登入後的返回點。

本機開發若要測登入，再加一條 `http://localhost:5173/**`。

---

## 關於網域限制

規格書要求「限定 `hlhs.hlc.edu.tw` 網域」。這件事有三層，強度不一樣，
**請不要只靠第一層**：

| 層級 | 做法 | 強度 |
|---|---|---|
| 1. 登入畫面提示 | 前端送出 `hd=hlhs.hlc.edu.tw` 參數 | **只是提示**，會讓 Google 預設只顯示學校帳號，但可被繞過，不算安全機制 |
| 2. OAuth 同意畫面設為「內部」 | 1-2 步驟選 Internal | **有效**，Google 直接拒絕非學校網域的帳號。只有 Workspace 組織才有這個選項 |
| 3. 資料庫 RLS | 已經做好了 | **最終防線**，就算有人用私人帳號登入進來，也讀不到、寫不進任何資料 |

第 3 層已經在上一步的 migration 完成並實測過：

- 學生寫入時會檢查 email 必須在 `hc_students` 名單上，校外帳號建不了資料列
- 學生只讀得到自己的資料，讀別人是 0 筆
- 教師只讀得到自己任教班級的學生

所以就算網域限制沒設成功，資料也不會外流 —— 頂多是有人登入後看到空白畫面。

---

## 設定完成後的驗證

1. 打開網站，用**你自己的學校帳號**登入 → 應該要能登入成功
2. 用**私人 Gmail** 登入 → 若第 1-2 步選了「內部」，Google 會直接拒絕；
   若選「外部」，會登入成功但看不到任何資料（這是 RLS 在擋，屬正常）
3. 借一位學生的帳號（或用你自己的帳號先在 `hc_students` 裡加一筆測試資料）
   → 應該只看得到自己的那一筆

## 常見錯誤訊息

| 訊息 | 原因 |
|---|---|
| `redirect_uri_mismatch` | 1-3 的重新導向 URI 填錯，對一次是不是 Supabase 的 `/auth/v1/callback` |
| 登入後回到空白頁或首頁 | 2-2 的 Redirect URLs 沒加，或少了結尾的 `/**` |
| `Unsupported provider` | 2-1 的 Google provider 沒開，或沒按 Save |
| 登入成功但看不到資料 | 正常 —— 該帳號的 email 不在 `hc_students` 名單上 |
| `access_blocked` / 應用程式未通過驗證 | OAuth 同意畫面還在「測試中」，把帳號加進測試使用者，或發布為正式版 |

---

**介面文字可能會變**：Google Cloud Console 與 Supabase 後台的選單名稱三不五時會調整。
若某個項目找不到，依「這一步要達成什麼」去找對應的位置即可，欄位要填的值不會變。
