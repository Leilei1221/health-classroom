-- =============================================================================
-- 健康管理模組：學生 email、身體量測、自我檢測
--
-- 只做「新增」：新增一個欄位、兩張表、相關 policy。
-- 不更動 hc_classes / hc_students 既有欄位，也不碰 join_code 選位與點名的
-- 任何 RPC 或 policy —— 那套免登入流程要繼續正常運作。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. hc_students.email：由學號生成，不需人工填寫
--
-- 用 generated column 而非一般欄位，是為了保證 email 永遠與學號一致，
-- 不會因為有人改到其中一邊而產生落差 —— 這個欄位是 RLS 判斷「這是不是你」
-- 的依據，一旦飄掉就是隱私問題。
--
-- 刻意「不」加唯一約束：hc_students 是每學期每班一列，同一位學生下學期
-- 會再有一列，email 本來就會重複。加了唯一約束，下學期匯入名單會整批失敗。
-- ---------------------------------------------------------------------------

alter table public.hc_students
  add column email text
  generated always as ('s' || student_no || '@hlhs.hlc.edu.tw') stored;

comment on column public.hc_students.email is
  '由學號生成的學校 Google 帳號，健康管理模組用來對應登入者；同一學生跨學期會有多列，故不唯一';

create index hc_students_email_idx on public.hc_students (email);

-- ---------------------------------------------------------------------------
-- 2. 判定輔助函式
--
-- 皆為 SECURITY DEFINER：policy 需要查 hc_students / hc_classes，
-- 但學生對這兩張表沒有讀取權限，必須由函式代為判斷。
-- ---------------------------------------------------------------------------

/** 這個 email 是否為名單上的學生（擋掉非學生帳號亂塞資料） */
create or replace function public.hc_is_known_student_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.hc_students s where s.email = p_email);
$$;

/** 目前登入的教師是否教到這個 email 的學生 */
create or replace function public.hc_teaches_student_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.hc_students s
    join public.hc_classes c on c.id = s.class_id
    where s.email = p_email
      and (c.teacher_id = auth.uid() or public.hc_is_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. hc_health_measurement：身體量測
--
-- 表名沿用專案的 hc_ 前綴（規格書寫 health_measurement）。
-- 這個 Supabase 專案與其他應用共用，前綴是避免撞名的既定約定。
-- ---------------------------------------------------------------------------

create table public.hc_health_measurement (
  id            uuid primary key default gen_random_uuid(),
  student_email text not null,
  semester      text not null,                             -- 例：'115-1'
  measured_at   date not null default current_date,
  round         text not null default 'initial'
                check (round in ('initial', 'mid', 'final')),

  machine_no    text,
  height_cm     numeric(5,1),
  weight_kg     numeric(5,1),
  body_fat_pct  numeric(4,1),
  visceral_fat  numeric(4,1),
  bmr_kcal      integer,
  body_age      integer,
  waist_cm      numeric(5,1),
  hip_cm        numeric(5,1),
  sbp           integer,
  dbp           integer,
  pulse         integer,
  spo2          integer,

  subcut_whole  numeric(4,1),
  subcut_trunk  numeric(4,1),
  subcut_arms   numeric(4,1),
  subcut_legs   numeric(4,1),
  muscle_whole  numeric(4,1),
  muscle_trunk  numeric(4,1),
  muscle_arms   numeric(4,1),
  muscle_legs   numeric(4,1),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (student_email, semester, round)
);

create index hc_health_measurement_email_idx
  on public.hc_health_measurement (student_email, semester);

create trigger hc_health_measurement_touch
  before update on public.hc_health_measurement
  for each row execute function public.hc_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. hc_health_selfcheck：課本自我檢測
-- ---------------------------------------------------------------------------

create table public.hc_health_selfcheck (
  id              uuid primary key default gen_random_uuid(),
  student_email   text not null,
  semester        text not null,

  lifestyle       text,      -- 課本 P14 生活型態
  mood_scale      text,      -- P224 心情溫度計
  stress_level    text,      -- P232 壓力檢測站
  depression      text,      -- P247 憂鬱情緒檢核
  diet_type       text,      -- 飲食金字塔測驗結果（A～G）

  h85210          jsonb not null default '{}'::jsonb,

  daily_kcal      integer,
  water_target_ml integer,
  water_actual_ml integer,
  fitness_note    text,

  needs_followup  boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (student_email, semester)
);

create index hc_health_selfcheck_email_idx
  on public.hc_health_selfcheck (student_email, semester);

create index hc_health_selfcheck_followup_idx
  on public.hc_health_selfcheck (needs_followup) where needs_followup;

create trigger hc_health_selfcheck_touch
  before update on public.hc_health_selfcheck
  for each row execute function public.hc_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS
--
-- 學生：只能讀寫自己的（以 JWT 的 email 比對），且該 email 必須在學生名單上
-- 教師：只能讀自己任教班級學生的資料，不能修改
-- anon：完全沒有權限（健康資料不走免登入流程）
-- ---------------------------------------------------------------------------

alter table public.hc_health_measurement enable row level security;
alter table public.hc_health_selfcheck   enable row level security;

create policy hc_health_measurement_student_own on public.hc_health_measurement
  for all to authenticated
  using (auth.jwt() ->> 'email' = student_email)
  with check (
    auth.jwt() ->> 'email' = student_email
    and public.hc_is_known_student_email(student_email)
  );

create policy hc_health_measurement_teacher_read on public.hc_health_measurement
  for select to authenticated
  using (public.hc_teaches_student_email(student_email));

create policy hc_health_selfcheck_student_own on public.hc_health_selfcheck
  for all to authenticated
  using (auth.jwt() ->> 'email' = student_email)
  with check (
    auth.jwt() ->> 'email' = student_email
    and public.hc_is_known_student_email(student_email)
  );

create policy hc_health_selfcheck_teacher_read on public.hc_health_selfcheck
  for select to authenticated
  using (public.hc_teaches_student_email(student_email));

-- ---------------------------------------------------------------------------
-- 6. 權限
--   anon 對健康資料表與判定函式一律無權。
--   Supabase 的 default privileges 會自動把新物件授權給 anon，
--   因此必須明確 revoke（僅對 PUBLIC 收回並不足夠）。
-- ---------------------------------------------------------------------------

revoke all on table
  public.hc_health_measurement,
  public.hc_health_selfcheck
from anon;

revoke execute on function
  public.hc_is_known_student_email(text),
  public.hc_teaches_student_email(text)
from public, anon;

grant execute on function
  public.hc_is_known_student_email(text),
  public.hc_teaches_student_email(text)
to authenticated;
