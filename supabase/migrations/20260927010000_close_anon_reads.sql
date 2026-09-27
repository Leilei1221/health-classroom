-- 關掉 anon 的讀取（蕾蕾 2026-09-27 授權）
--
-- ── 發現的問題 ─────────────────────────────────────────────────────
-- 七張表上有名為 gas_anon_read 的 policy，對象是 anon、條件寫死 true，
-- 而 anon 也有對應的 SELECT 權限。anon key 就印在前端 bundle 裡，
-- 任何人檢視原始碼就拿得到。
--
-- 2026-09-27 實測（set local role anon，未帶任何 JWT）：
--   hc_students             201 筆（姓名、學號、學校信箱）
--   hc_attendance          1207 筆
--   hc_seat_assignments     200 筆
--   hc_performance_records   45 筆（含扣分理由的自由文字）
--   hc_classes                6 筆（含每個班的 join_code）
-- 拿到 join_code 等於可以開任何一班的選位頁，看到那班完整名單。
--
-- ── 為什麼可以直接關 ───────────────────────────────────────────────
-- policy 的名字說是給 Google Apps Script 用的，但 GAS 實際上用的是
-- service_role key（google-apps-script/Code.gs 的 CONFIG 與 README 都寫明，
-- key 放 Script Properties）。service_role 繞過 RLS，不受這次改動影響。
--
-- 免登入的選位／點名流程走三支 SECURITY DEFINER 函式
-- （hc_seat_picking_info／hc_claim_seat／hc_release_seat）。
-- SECURITY DEFINER 以函式擁有者的身分執行，不看呼叫者對表的權限，
-- 所以也不受影響。前端沒有任何一處以 anon 身分直接查這些表
-- （查過 src/：選位頁只呼叫那三支 RPC）。
--
-- 結論：這幾條是早期版本的殘留，現在沒有東西在用。
--
-- ── 順手收掉兩個過寬的授權 ─────────────────────────────────────────
-- hc_health_scale_tally 與 hc_health_tally_done 給了 anon 全套權限
-- （INSERT/UPDATE/DELETE/TRUNCATE…）。兩張表的 RLS 都開著、也都沒有
-- anon 的 policy，所以實際上進不去；但這種授權沒有理由留著。

-- ---------------------------------------------------------------------------
-- 一、拿掉 anon 的 policy
-- ---------------------------------------------------------------------------
drop policy if exists gas_anon_read on public.hc_students;
drop policy if exists gas_anon_read on public.hc_classes;
drop policy if exists gas_anon_read on public.hc_attendance;
drop policy if exists gas_anon_read on public.hc_attendance_statuses;
drop policy if exists gas_anon_read on public.hc_lessons;
drop policy if exists gas_anon_read on public.hc_performance_records;
drop policy if exists gas_anon_read on public.hc_seat_assignments;

-- ---------------------------------------------------------------------------
-- 二、連權限一起收回
--
-- 只拿掉 policy 的話，RLS 仍然會擋住；但權限留著等於下一個人只要
-- 不小心加一條 policy，資料就又出去了。兩層一起收。
-- ---------------------------------------------------------------------------
revoke select on public.hc_students            from anon;
revoke select on public.hc_classes             from anon;
revoke select on public.hc_attendance          from anon;
revoke select on public.hc_attendance_statuses from anon;
revoke select on public.hc_lessons             from anon;
revoke select on public.hc_performance_records from anon;
revoke select on public.hc_seat_assignments    from anon;

revoke all on public.hc_health_scale_tally from anon;
revoke all on public.hc_health_tally_done  from anon;

-- ---------------------------------------------------------------------------
-- 三、免登入的那三支函式維持原樣
--
-- 這三支是選位與點名唯一需要的 anon 入口，這個 migration 不碰它們。
-- 重新宣告一次授權，當作紀錄，也避免日後有人整批 revoke 時連它們一起收掉。
-- ---------------------------------------------------------------------------
grant execute on function
  public.hc_seat_picking_info(text),
  public.hc_claim_seat(text, uuid, smallint, smallint, text),
  public.hc_release_seat(text, uuid)
  to anon;
