# 資料表設計（v1）

部署在共用的 Supabase 專案，因此所有物件一律加 `hc_` 前綴，且只在自己的 table 上動 RLS／GRANT。

Migration：`supabase/migrations/20260829000000_health_classroom_init.sql`

## Table 一覽（14 張 + 1 個 view）

| # | Table | 用途 |
|---|---|---|
| 1 | `hc_teachers` | 教師，PK 對應 `auth.users.id`；註冊時由 trigger 自動建檔 |
| 2 | `hc_classes` | 授課班級（學年度＋學期＋班名），含分組設定與 `join_code` |
| 3 | `hc_students` | 學生名單，Excel 匯入目標；轉學休學以 `is_active` 停用而非刪除 |
| 4 | `hc_seat_assignments` | 座位登記，以 `(group_no, seat_slot)` 定位，一生一位、一位一生 |
| 5 | `hc_lessons` | 每一堂課（班級＋日期＋節次） |
| 6 | `hc_attendance_statuses` | 點名狀態字典（5 種，扣分值可調） |
| 7 | `hc_attendance` | 點名紀錄，每堂課每生一筆 |
| 8 | `hc_performance_items` | 表現項目字典，含 8 筆系統預設 |
| 9 | `hc_performance_records` | 上課表現，累計制、同堂課同生可多筆 |
| 10 | `hc_groups` | 分組 |
| 11 | `hc_group_members` | 組員 |
| 12 | `hc_import_batches` | Excel 匯入批次紀錄 |
| 13 | `hc_sync_log` | Google Sheets 匯出紀錄 |
| 14 | `hc_settings` | 設定，可掛教師層級或班級層級 |
| view | `hc_student_scores` | 學生總分＝出缺席分＋表現分 |

## 分組座位

教室為分組討論桌，不是列×行格子，因此建立班級時填的是「組數」與「每組人數上限」。

| 設定 | 預設 | 說明 |
|---|---|---|
| `group_count` | 7 | 分組數；308 班為 8 組 |
| `group_capacity` | 5 | 每組人數上限 |

每組 U 字型就座：**左 2、右 2、桌子後端 1**。
`seat_slot` 為 1 起算的連續整數，落在 U 的哪一段由前端 `src/lib/seating.ts` 決定
（左側由上而下、接右側由上而下、最後一個為後端），資料庫只保證同組內不重複。

兩排擺放與教室實際佈置一致：上排 `floor(n/2)` 組、下排其餘。7 組＝上 3 下 4，8 組＝上 4 下 4。

搶位由 unique constraint `(class_id, group_no, seat_slot)` 在資料庫層擋下。

## Excel 名單匯入

`hc_import_roster(p_payload jsonb)` 依「班級」欄自動建立班級並寫入學生。

- 欄位：**班級、座號、學號、姓名**（座號可缺），第一列為標題列；支援 .xlsx 與 .csv
- 同一個 `(class_id, student_no)` 視為同一位學生，重複匯入為更新而非新增
- 每個班級可有各自的組數，因此 308 可設 8 組而其餘維持 7 組
- 刻意使用 **SECURITY INVOKER**：以呼叫的教師身分執行，RLS 照常生效，
  教師只能建立／修改自己的班級；`anon` 無執行權限
- 每次匯入寫一筆 `hc_import_batches`，含新增／更新筆數與各班摘要

## 點名狀態

| code | 標籤 | 扣分 | 備註 |
|---|---|---|---|
| `present` | 出席 | 0 | 預設 |
| `late` | 遲到 | -2 | |
| `absent` | 曠課 | -5 | |
| `leave` | 請假 | 0 | |
| `official` | 公假 | 0 | 需填備註 |

字典可調整；`hc_attendance.points` 存記錄當下的快照，日後改扣分值不會回頭改動歷史成績。
`hc_performance_records.label` 同理。

## 學生選位（免登入）

學生不需帳號。老師開啟選位後，學生掃 QR → 選自己名字 → 點空位。

安全模型：`anon` 角色對**所有** `hc_` table 都被 `REVOKE`，只被授權執行三個
`SECURITY DEFINER` RPC，全部要求正確的 `join_code`：

- `hc_seat_picking_info(code)` — 取得班級分組設定、學生清單、已佔用座位
- `hc_claim_seat(code, student_id, group_no, seat_slot, student_no?)` — 選位／改位
- `hc_release_seat(code, student_id)` — 放棄座位

`join_code` 為 `gen_random_bytes(9)` 的 base64（約 72 bits），無法暴力猜測。
未開放選位（`seat_picking_open = false`）時 RPC 一律拒絕，等於老師手上的開關。
`seat_picking_require_student_no` 開啟後需再輸入學號後三碼，預設關閉。

## RLS

- 教師只看得到自己的班級；跨班讀、寫、改一律擋下。
- 所有掛 `class_id` 的表走 `hc_owns_class()`；掛 `lesson_id` 的表再往上查一層。
- `hc_is_admin()` / `hc_owns_class()` 為 `SECURITY DEFINER`，避免 policy 遞迴。
  兩者對 PUBLIC 與 anon 收回 EXECUTE，只授權給 `authenticated`。
  注意 policy 運算式是以「呼叫者的角色」執行的，所以 authenticated 的明確授權
  不可省略；另外 Supabase 的 default privileges 會自動把新函式授權給 anon，
  僅對 PUBLIC 收回並不足夠，必須對 anon 另外 revoke。

## 健康管理模組

與座位／點名完全分離的另一套流程：**學生要用學校 Google 帳號登入**，
資料以 RLS 保護。座位登記與點名維持原本的 join_code 免登入流程，兩者並存。

### `hc_students.email`

由學號生成的 generated column：`'s' || student_no || '@hlhs.hlc.edu.tw'`

用 generated column 而非一般欄位，是因為這個欄位是 RLS 判斷「這是不是你」的依據，
一旦與學號產生落差就是隱私問題。

**刻意不加唯一約束**：`hc_students` 是每學期每班一列，同一位學生下學期會再有一列，
email 本來就會重複。加了唯一約束，下學期匯入名單會整批失敗。

### 資料表

| Table | 用途 |
|---|---|
| `hc_health_measurement` | 身體量測，`unique (student_email, semester, round)`，round 為 initial/mid/final |
| `hc_health_selfcheck` | 課本自我檢測，`unique (student_email, semester)`，含 `needs_followup` |

表名沿用專案的 `hc_` 前綴（規格書寫 `health_measurement`）；此 Supabase 專案與
其他應用共用，前綴是避免撞名的既定約定。

### RLS

| 角色 | 權限 |
|---|---|
| 學生 | 只能讀寫 `auth.jwt() ->> 'email'` 等於自己 email 的列，且該 email 必須在學生名單上 |
| 教師 | 只能**讀**自己任教班級學生的資料，不能修改或刪除 |
| anon | 完全無權限 |

寫入時多一道 `hc_is_known_student_email()` 檢查，非名單上的帳號（例如校外 gmail）
即使登入也無法建立資料列。

兩個判定函式皆為 `SECURITY DEFINER`（學生對 `hc_students` / `hc_classes` 沒有讀取權限，
必須由函式代為判斷），且僅授權給 `authenticated`。

## 驗證

本 migration 已在本機 PostgreSQL 16 實際跑過並通過：

- 選位流程 13 個案例（含搶位、停用座位、超出範圍、改位、學號驗證、放棄座位）
- RLS 隔離：跨教師讀取、UPDATE、INSERT 全數被擋
- `anon` 讀 table 被拒、但可正常呼叫選位 RPC
- 14 張表全數啟用 RLS

### 線上驗證（正式專案 fcstpyiggvhduaztwlrf）

migration 套用後以 `anon` 角色實測，六項全數被擋：

| 探測 | 結果 |
|---|---|
| 讀 `hc_students` / `hc_classes` | permission denied for table |
| 讀 `hc_student_scores` | permission denied for view |
| 呼叫 `hc_ensure_teacher` / `hc_is_admin` | permission denied for function |
| 猜 `join_code` | invalid_code |

Supabase security advisor：**0 個 ERROR**。剩餘 WARN 為選位 RPC 對 anon 開放，
屬本系統的刻意設計。

### 健康管理模組（正式專案實測）

| 情境 | 結果 |
|---|---|
| 學生寫入自己的量測 | 成功 |
| 學生冒用其他學生 email 寫入 | 被 RLS 擋下 |
| 校外 gmail 帳號寫入 | 被 RLS 擋下 |
| 學生讀取他人資料 | 讀到 0 筆 |
| 授課教師讀自己班學生 | 讀得到 |
| 非授課教師讀該學生 | 讀到 0 筆 |
| 教師修改／刪除學生健康資料 | `UPDATE 0` / `DELETE 0` |
| anon 讀健康資料表、呼叫判定函式 | permission denied |
| 既有 anon 選位流程 | 不受影響，照常運作 |
