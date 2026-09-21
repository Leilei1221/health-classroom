-- 鎖住紅旗的處理紀錄欄位（蕾蕾 2026-09-21 決定，解法甲）
--
-- ── 為什麼 ─────────────────────────────────────────────────────────
-- hc_health_selfcheck 上學生的 policy 是 ALL（自己那一列全開），而 RLS 只能
-- 限制「哪幾列」、不能限制「哪幾欄」。所以一個會開開發者工具的學生，可以對
-- 自己那一列直接送 update，把 risk_reviewed 改成 true 或 risk_level 改成 0，
-- 旗子就從教師端消失了。
--
-- 蕾蕾的理由不是風險高低，是後果不成比例：
--   「能把自己的求救訊號關掉的系統，等於沒有那個機制。會開開發者工具的學生
--     不多，但只要有一個、而且剛好是勾了第 20 題那個，我就永遠不會知道。」
--
-- 解法乙（把判定規則也搬進資料庫現算）沒有採用：規則會變成 riskLevel.ts 與
-- SQL 兩份，改門檻時要同步兩邊，那本身就是新的風險來源。
--
-- ── 怎麼擋 ─────────────────────────────────────────────────────────
-- BEFORE INSERT OR UPDATE 的 trigger，只對 **PostgREST 直送的寫入**生效
-- （那種寫入的 current_user 是 authenticated）。SECURITY DEFINER 函式
-- ——也就是 hc_health_risk_review()——執行時 current_user 是函式擁有者，
-- 服務端維護（service_role／postgres）也不是 authenticated，兩條路都放行。
-- 所以這支函式**必須是 security invoker**（預設）：寫成 definer 的話
-- current_user 會變成擁有者，這個判斷就永遠成立，等於沒擋。
--
-- 擋法是「還原成舊值」，不是 raise。理由是時機：學生按下送出的那一刻
-- 正好可能是他剛勾完第 20 題，這時候讓整筆儲存失敗是最糟的結果。
-- 改不動就是改不動，畫面照常成功，資料庫維持原樣。
--
-- ── 四個處理紀錄欄位以外，順便補三件事 ───────────────────────────
-- 1. depression_critical 的黏性下放到資料庫。規格書寫「一旦為 true 就不能被
--    重測覆蓋回 false」，但那條原本只在前端的 saveSelfcheck 裡執行，
--    繞過前端就沒了。
-- 2. risk_level 與 risk_l3_count 只能往上，不能往下。
--    ⚠️ 這一條有一個真的行為改變：學生重做之後分數變低時，等級不會跟著降。
--    risk_level 的語意因此變成「這學期判定過的最高等級」。
--    這是無法兩全的地方——資料庫分不出「誠實重測算出來的 1」與「自己改成的 1」，
--    要分得出來只有解法乙。教師端關掉個案的方式是「已聯繫」，不是等等級自己降。
-- 3. risk_flagged_at 可以往後更新（升級時前端會更新它），但不能被清成 null。
--
-- needs_followup 沒有動：教師端已經全部改看 risk_level，那個舊布林值現在
-- 沒有任何畫面在讀，不值得為它多加一條規則。

create or replace function public.hc_guard_risk_columns()
returns trigger
language plpgsql
-- 刻意不是 security definer，理由見上面
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- 可信任的路徑（SECURITY DEFINER 函式、service_role、維護連線）直接放行
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- 新的一列不可能「已經處理過」
    new.risk_reviewed    := false;
    new.risk_reviewed_at := null;
    new.risk_outcome     := null;
    new.risk_note        := null;
    return new;
  end if;

  -- 處理紀錄四欄：只有 hc_health_risk_review() 改得動
  new.risk_reviewed    := old.risk_reviewed;
  new.risk_reviewed_at := old.risk_reviewed_at;
  new.risk_outcome     := old.risk_outcome;
  new.risk_note        := old.risk_note;

  -- 警示只能往上，不能往下
  new.depression_critical := old.depression_critical or coalesce(new.depression_critical, false);
  new.risk_level    := greatest(coalesce(new.risk_level, 0), coalesce(old.risk_level, 0));
  new.risk_l3_count := greatest(coalesce(new.risk_l3_count, 0), coalesce(old.risk_l3_count, 0));
  if new.risk_flagged_at is null then
    new.risk_flagged_at := old.risk_flagged_at;
  end if;

  return new;
end;
$function$;

comment on function public.hc_guard_risk_columns() is
  '學生改得動自己那一列，但改不動紅旗的處理紀錄，也調不低警示。必須是 security invoker';

drop trigger if exists hc_guard_risk on public.hc_health_selfcheck;
create trigger hc_guard_risk
  before insert or update on public.hc_health_selfcheck
  for each row execute function public.hc_guard_risk_columns();
