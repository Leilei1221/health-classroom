-- 紅旗規格第七節・第 1 步：補欄位
-- 規格書：docs/課本檢測_等第對應與紅旗處理規格.md
--
-- ── 為什麼「逐題作答」不存 ─────────────────────────────────────────
-- 規格書第七節要求先確認能不能存下四個量表的逐題作答。實查結果：
--   生活型態 10 題  → lifestyle jsonb 存三區題號，逐題答案本來就完整（71 筆驗過）
--   85210 七項      → h85210 jsonb 七個 key，本來就是逐題
--   BSRS-5／壓力／情緒 → 只有總分
-- 但把規格書裡的功能逐項對過之後，這三個量表的逐題作答**一題都用不到**：
-- 紅旗判定只要總分＋情緒第 20 題，建議庫的 trigger 只用等第層級。
-- 加上規格書第六節要求原始作答學期末要刪除——不存就沒有這個問題。
-- 蕾蕾 2026-09-20 決定：不存逐題，改存下面的班級層級統計。

-- ---------------------------------------------------------------------------
-- 一、紅旗判定與處理紀錄（規格書第五節）
-- ---------------------------------------------------------------------------
alter table public.hc_health_selfcheck
  add column if not exists risk_level smallint not null default 0,
  add column if not exists risk_flagged_at timestamptz,
  add column if not exists risk_reviewed boolean not null default false,
  add column if not exists risk_reviewed_at timestamptz,
  add column if not exists risk_outcome text,
  add column if not exists risk_note text;

do $$ begin
  alter table public.hc_health_selfcheck
    add constraint hc_health_selfcheck_risk_level_check
    check (risk_level between 0 and 3);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.hc_health_selfcheck
    add constraint hc_health_selfcheck_risk_outcome_check
    check (risk_outcome is null
           or risk_outcome in ('needs_support', 'observed_ok', 'joking', 'other'));
exception when duplicate_object then null; end $$;

comment on column public.hc_health_selfcheck.risk_level is
  '0-3。送出時即時計算後寫入，不是查詢時現算——這是要留紀錄的判定，不是可變的呈現';
comment on column public.hc_health_selfcheck.risk_outcome is
  'needs_support 需要持續關心｜observed_ok 課堂觀察後無虞｜joking 疑似玩笑｜other 其他';

-- 教師端要「L3 置頂、未處理的不會消失」，這條索引就是那個查詢
create index if not exists hc_health_selfcheck_risk_idx
  on public.hc_health_selfcheck (risk_level desc, risk_reviewed, updated_at desc)
  where risk_level > 0;

-- ---------------------------------------------------------------------------
-- 二、教師標記「已聯繫」
--
-- 用 SECURITY DEFINER 函式而不是開一條 UPDATE policy：
-- authenticated 在這張表上有 table-level UPDATE 權限，RLS 只能限制「哪幾列」、
-- 不能限制「哪幾欄」。開 policy 等於讓老師改得動學生的作答內容。
-- 這支函式只碰 risk_reviewed / risk_reviewed_at / risk_outcome / risk_note 四欄。
-- ---------------------------------------------------------------------------
create or replace function public.hc_health_risk_review(
  p_student_email text,
  p_semester      text,
  p_reviewed      boolean,
  p_outcome       text default null,
  p_note          text default null
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.hc_teaches_student_email(p_student_email) then
    raise exception 'not your student';
  end if;
  if p_outcome is not null
     and p_outcome not in ('needs_support', 'observed_ok', 'joking', 'other') then
    raise exception 'bad outcome %', p_outcome;
  end if;

  update public.hc_health_selfcheck
     set risk_reviewed    = p_reviewed,
         risk_reviewed_at = case when p_reviewed then now() else null end,
         risk_outcome     = p_outcome,
         risk_note        = p_note
   where student_email = p_student_email
     and semester = p_semester;
end;
$function$;

revoke execute on function public.hc_health_risk_review(text, text, boolean, text, text)
  from public, anon;
grant execute on function public.hc_health_risk_review(text, text, boolean, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 三、班級層級的逐題統計（匿名，不綁個人）
--
-- 蕾蕾課堂上要討論「哪幾題大家都勾了」。要算這個就需要逐題資料，
-- 但逐題資料不存在個人身上——所以改成送出當下直接累加到班級計數，
-- 資料庫裡從頭到尾不會有「某某人第幾題勾了什麼」這件事。
--
-- 排除兩題，理由相同：
--   BSRS-5 ★自殺想法      → 走紙本，線上根本沒有
--   情緒檢視表第 20 題      → 「我想要消失不見」。班上只有一個人勾的時候，
--                            把「1 人」投到布幕上等於指著那個人。
--   這一條是我加的安全預設，蕾蕾要放回來再改 TALLY_SKIP。
-- ---------------------------------------------------------------------------
create table if not exists public.hc_health_scale_tally (
  class_id   uuid not null references public.hc_classes(id) on delete cascade,
  semester   text not null,
  scale      text not null,
  item_no    smallint not null,
  choice     smallint not null,
  n          integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (class_id, semester, scale, item_no, choice)
);

comment on table public.hc_health_scale_tally is
  '班級層級的逐題勾選人數。匿名，不綁個人；每人每份量表只計第一次送出';

alter table public.hc_health_scale_tally enable row level security;

-- 老師只讀自己的班；誰都不能直接寫，只能經過下面那支函式
drop policy if exists hc_health_scale_tally_teacher_read on public.hc_health_scale_tally;
create policy hc_health_scale_tally_teacher_read on public.hc_health_scale_tally
  for select to authenticated
  using (public.hc_owns_class(class_id));

-- 「這個人這份量表已經計過了」。只記有沒有，不記內容——
-- 這件事從 hc_health_selfcheck 本來就看得出來，不是新增的資訊。
create table if not exists public.hc_health_tally_done (
  student_email text not null,
  semester      text not null,
  scale         text not null,
  created_at    timestamptz not null default now(),
  primary key (student_email, semester, scale)
);
alter table public.hc_health_tally_done enable row level security;
-- 刻意不建任何 policy：只有 SECURITY DEFINER 函式碰得到

create or replace function public.hc_health_tally_submit(
  p_semester text,
  p_scale    text,
  p_answers  smallint[]
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := auth.jwt() ->> 'email';
  v_class uuid;
begin
  if p_scale not in ('lifestyle', 'h85210', 'stress', 'depression', 'mood') then
    raise exception 'unknown scale %', p_scale;
  end if;
  if p_answers is null or array_length(p_answers, 1) is null then
    return;
  end if;

  -- 只收白名單班級的在籍學生；查不到就安靜跳過，不要讓統計擋住送出
  select s.class_id into v_class
  from public.hc_students s
  join public.hc_classes c on c.id = s.class_id
  where coalesce(s.login_email, s.email) = v_email
    and s.is_active and c.is_active and c.health_enabled
  limit 1;
  if v_class is null then
    return;
  end if;

  -- 一人一份只計一次。重做會更新自己的作答，但不會再進統計一次：
  -- 要能扣掉舊答案就得存住舊答案，那正是這個設計要避免的事。
  insert into public.hc_health_tally_done (student_email, semester, scale)
  values (v_email, p_semester, p_scale)
  on conflict do nothing;
  if not found then
    return;
  end if;

  insert into public.hc_health_scale_tally (class_id, semester, scale, item_no, choice, n)
  select v_class, p_semester, p_scale, i::smallint, p_answers[i], 1
  from generate_subscripts(p_answers, 1) i
  where p_answers[i] is not null
    -- 情緒檢視表第 20 題不計入，見上面的說明
    and not (p_scale = 'depression' and i = 20)
  on conflict (class_id, semester, scale, item_no, choice)
  do update set n = public.hc_health_scale_tally.n + 1, updated_at = now();
end;
$function$;

revoke execute on function public.hc_health_tally_submit(text, text, smallint[])
  from public, anon;
grant execute on function public.hc_health_tally_submit(text, text, smallint[])
  to authenticated;
