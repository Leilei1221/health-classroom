-- answered_at：學生最後一次作答的時間
--
-- hc_health_selfcheck 上有 BEFORE UPDATE 的 hc_touch_updated_at()，
-- 任何 UPDATE 都會把 updated_at 蓋成 now()。教師標記「已聯繫」也是 UPDATE，
-- 所以標記完之後，紅旗頁（照 updated_at 排序）與明細頁（顯示「自我檢測最後更新」）
-- 會讓那位學生看起來像剛剛重新作答過——那是假的。
--
-- 與其跟 trigger 對抗（BEFORE 觸發器會蓋掉我們設的值，要繞過只能動到
-- session_replication_role 或另外掛一個順序在後面的觸發器，兩種都很脆弱），
-- 不如把兩件事分開：
--   updated_at  = 這一列最後被寫過的時間（含教師標記）
--   answered_at = 學生最後一次送出作答的時間（只有送出時才動）
--
-- 既有資料回填時還沒有人被標記過，所以那時的 updated_at 就是作答時間。
alter table public.hc_health_selfcheck
  add column if not exists answered_at timestamptz;

comment on column public.hc_health_selfcheck.answered_at is
  '學生最後一次送出作答的時間。教師標記已聯繫不會動它——那會動到的是 updated_at';

update public.hc_health_selfcheck
   set answered_at = updated_at
 where answered_at is null;
