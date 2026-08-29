# 資料表設計（v1）

部署在共用的 Supabase 專案，因此所有物件一律加 `hc_` 前綴，且只在自己的 table 上動 RLS／GRANT。

Migration：`supabase/migrations/20260829000000_health_classroom_init.sql`

## Table 一覽（14 張 + 1 個 view）

| # | Table | 用途 |
|---|---|---|
| 1 | `hc_teachers` | 教師，PK 對應 `auth.users.id`；註冊時由 trigger 自動建檔 |
| 2 | `hc_classes` | 授課班級（學年度＋學期＋班名），含座位圖尺寸與 `join_code` |
| 3 | `hc_students` | 學生名單，Excel 匯入目標；轉學休學以 `is_active` 停用而非刪除 |
| 4 | `hc_seat_assignments` | 座位登記，一生一位、一位一生（學期固定） |
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

- `hc_seat_picking_info(code)` — 取得班級、學生清單、已occupied座位
- `hc_claim_seat(code, student_id, row, col, student_no?)` — 選位／改位
- `hc_release_seat(code, student_id)` — 放棄座位

`join_code` 為 `gen_random_bytes(9)` 的 base64（約 72 bits），無法暴力猜測。
未開放選位（`seat_picking_open = false`）時 RPC 一律拒絕，等於老師手上的開關。
`seat_picking_require_student_no` 開啟後需再輸入學號後三碼，預設關閉。

搶位以 unique constraint `(class_id, seat_row, seat_col)` 在資料庫層擋下，
不靠前端檢查，因此併發下不會兩人選到同一位。

## RLS

- 教師只看得到自己的班級；跨班讀、寫、改一律擋下。
- 所有掛 `class_id` 的表走 `hc_owns_class()`；掛 `lesson_id` 的表再往上查一層。
- `hc_is_admin()` / `hc_owns_class()` 為 `SECURITY DEFINER`，避免 policy 遞迴。
  兩者對 PUBLIC 與 anon 收回 EXECUTE，只授權給 `authenticated`。
  注意 policy 運算式是以「呼叫者的角色」執行的，所以 authenticated 的明確授權
  不可省略；另外 Supabase 的 default privileges 會自動把新函式授權給 anon，
  僅對 PUBLIC 收回並不足夠，必須對 anon 另外 revoke。

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
