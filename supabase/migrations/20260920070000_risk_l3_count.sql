-- L3 觸發次數
--
-- 規格書第五節教師端：「同一位學生**第二次以上**觸發 L3 時，要特別標示
-- 『重複觸發』——不管上一次判定成什麼，重複出現就值得再看一次。」
--
-- 現有欄位推不出這件事：depression_critical 是黏的（一旦為 true 就不再
-- 回復 false），所以那個旗標只說「曾經答過是」，說不出「答過幾次是」。
-- risk_flagged_at 也只有一個時間點。
--
-- 所以另外記一個計數：**學生這一次送出的情緒自我檢視表第 20 題答「是」**
-- 時加一。注意是「這一次的作答」，不是「目前的黏著旗標」——
-- 否則學生重做任何一份量表都會被算成又觸發一次。
alter table public.hc_health_selfcheck
  add column if not exists risk_l3_count smallint not null default 0;

comment on column public.hc_health_selfcheck.risk_l3_count is
  '情緒自我檢視表第 20 題答「是」的次數；≥2 在教師端標示「重複觸發」';

-- 既有的 7 位已經答過是，至少算一次。實際次數無從回溯，取最小值。
update public.hc_health_selfcheck
   set risk_l3_count = 1
 where depression_critical and risk_l3_count = 0;
