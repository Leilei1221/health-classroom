-- =============================================================================
-- 花蓮高中 健護課教室管理系統 — 初始 schema
--
-- 部署於「共用的」Supabase 專案，因此：
--   * 所有物件一律使用 hc_ 前綴，避免與既有 app 撞名
--   * 只在自己的 table 上動 RLS / GRANT，絕不對 public schema 做全域 revoke
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 共用工具
-- ---------------------------------------------------------------------------

create or replace function public.hc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 1. hc_teachers — 教師（對應 Supabase Auth）
-- ---------------------------------------------------------------------------

create table public.hc_teachers (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text not null default '',
  role         text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger hc_teachers_touch
  before update on public.hc_teachers
  for each row execute function public.hc_touch_updated_at();

-- 教師檔案採「首次登入時延遲建立」，不在共用的 auth.users 上掛 trigger。
-- 本專案與其他應用共用同一組 auth，掛 trigger 會讓其他 app 的使用者
-- 也被建立 hc_teachers 資料列，因此改由前端登入後呼叫此 RPC。
create or replace function public.hc_ensure_teacher()
returns public.hc_teachers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_user  auth.users;
  v_row   public.hc_teachers;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0010';
  end if;

  select * into v_user from auth.users where id = v_uid;

  insert into public.hc_teachers (id, email, display_name)
  values (
    v_uid,
    coalesce(v_user.email, ''),
    coalesce(v_user.raw_user_meta_data ->> 'full_name',
             split_part(coalesce(v_user.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email
  returning * into v_row;

  return v_row;
end;
$$;


-- ---------------------------------------------------------------------------
-- RLS 輔助函式（hc_owns_class 定義於 hc_classes 建立之後）
--   SECURITY DEFINER：在 policy 內查詢時繞過被查表自身的 RLS，避免遞迴
-- ---------------------------------------------------------------------------

create or replace function public.hc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.hc_teachers t
    where t.id = auth.uid() and t.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. hc_classes — 授課班級（一個學年度＋學期＋班級為一筆）
-- ---------------------------------------------------------------------------

create table public.hc_classes (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.hc_teachers(id) on delete restrict,
  academic_year smallint not null,                       -- 學年度，例：115
  semester      smallint not null check (semester in (1, 2)),
  name          text not null,                           -- 例：高一忠
  grade         smallint check (grade between 1 and 3),

  -- 座位圖
  seat_rows      smallint not null default 6 check (seat_rows between 1 and 20),
  seat_cols      smallint not null default 6 check (seat_cols between 1 and 20),
  disabled_seats jsonb not null default '[]'::jsonb,     -- 走道/壞掉的位子 [{"row":1,"col":3}]

  -- 學生選位（不需登入，靠 join_code）
  join_code                    text not null unique default encode(gen_random_bytes(9), 'base64'),
  seat_picking_open            boolean not null default false,
  seat_picking_require_student_no boolean not null default false, -- 開啟則需輸入學號後三碼

  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (teacher_id, academic_year, semester, name)
);

create index hc_classes_teacher_idx on public.hc_classes (teacher_id, academic_year desc, semester desc);

create trigger hc_classes_touch
  before update on public.hc_classes
  for each row execute function public.hc_touch_updated_at();

-- 必須定義於 hc_classes 之後：language sql 的函式本體在建立時即會驗證
create or replace function public.hc_owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.hc_classes c
    where c.id = p_class_id
      and (c.teacher_id = auth.uid() or public.hc_is_admin())
  );
$$;


-- ---------------------------------------------------------------------------
-- 3. hc_students — 學生名單（Excel 匯入目標）
-- ---------------------------------------------------------------------------

create table public.hc_students (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.hc_classes(id) on delete cascade,
  student_no text not null,                              -- 學號
  seat_no    smallint,                                   -- 座號
  name       text not null,
  gender     text check (gender in ('M', 'F', 'X')),
  note       text not null default '',                   -- 健康狀況等特殊註記
  is_active  boolean not null default true,              -- 轉學/休學：停用而非刪除
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (class_id, student_no)
);

create unique index hc_students_seat_no_key
  on public.hc_students (class_id, seat_no)
  where seat_no is not null;

create index hc_students_class_idx on public.hc_students (class_id) where is_active;

create trigger hc_students_touch
  before update on public.hc_students
  for each row execute function public.hc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 4. hc_seat_assignments — 座位登記（每學期固定，老師可調位）
--    一生一位、一位一生，皆以 class_id 為範圍
-- ---------------------------------------------------------------------------

create table public.hc_seat_assignments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.hc_classes(id) on delete cascade,
  student_id  uuid not null references public.hc_students(id) on delete cascade,
  seat_row    smallint not null check (seat_row >= 1),
  seat_col    smallint not null check (seat_col >= 1),
  assigned_by text not null default 'student' check (assigned_by in ('student', 'teacher')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (class_id, student_id),
  unique (class_id, seat_row, seat_col)
);

create trigger hc_seat_assignments_touch
  before update on public.hc_seat_assignments
  for each row execute function public.hc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 5. hc_lessons — 每一堂課
-- ---------------------------------------------------------------------------

create table public.hc_lessons (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.hc_classes(id) on delete cascade,
  lesson_date date not null,
  period      smallint not null check (period between 1 and 12),
  topic       text not null default '',
  note        text not null default '',
  created_by  uuid references public.hc_teachers(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (class_id, lesson_date, period)
);

create index hc_lessons_class_date_idx on public.hc_lessons (class_id, lesson_date desc);

create trigger hc_lessons_touch
  before update on public.hc_lessons
  for each row execute function public.hc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 6. hc_attendance_statuses — 點名狀態字典（扣分值可調）
-- ---------------------------------------------------------------------------

create table public.hc_attendance_statuses (
  code           text primary key,
  label          text not null,
  default_points numeric(5,1) not null default 0,        -- 負數為扣分
  requires_note  boolean not null default false,
  sort_order     smallint not null default 0,
  is_active      boolean not null default true
);

insert into public.hc_attendance_statuses (code, label, default_points, requires_note, sort_order) values
  ('present',  '出席', 0,  false, 1),
  ('late',     '遲到', -2, false, 2),
  ('absent',   '曠課', -5, false, 3),
  ('leave',    '請假', 0,  false, 4),
  ('official', '公假', 0,  true,  5);


-- ---------------------------------------------------------------------------
-- 7. hc_attendance — 點名紀錄（每堂課每生一筆）
--    points 為記錄當下的快照，日後調整字典不會回頭改動歷史
-- ---------------------------------------------------------------------------

create table public.hc_attendance (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references public.hc_lessons(id) on delete cascade,
  student_id  uuid not null references public.hc_students(id) on delete cascade,
  status      text not null references public.hc_attendance_statuses(code),
  points      numeric(5,1) not null default 0,
  note        text not null default '',
  recorded_by uuid references public.hc_teachers(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (lesson_id, student_id)
);

create index hc_attendance_student_idx on public.hc_attendance (student_id);

create trigger hc_attendance_touch
  before update on public.hc_attendance
  for each row execute function public.hc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 8. hc_performance_items — 上課表現項目字典
-- ---------------------------------------------------------------------------

create table public.hc_performance_items (
  id             uuid primary key default gen_random_uuid(),
  teacher_id     uuid references public.hc_teachers(id) on delete cascade, -- null = 系統預設
  code           text not null,
  label          text not null,
  default_points numeric(5,1) not null,
  category       text not null default '',               -- 參與 / 紀律 / 作業
  sort_order     smallint not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create unique index hc_performance_items_code_key
  on public.hc_performance_items (coalesce(teacher_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

insert into public.hc_performance_items (code, label, default_points, category, sort_order) values
  ('answer',     '回答問題',   1,  '參與', 1),
  ('volunteer',  '主動發表',   2,  '參與', 2),
  ('group_work', '小組表現佳', 1,  '參與', 3),
  ('helper',     '協助同學',   1,  '參與', 4),
  ('phone',      '使用手機',  -1,  '紀律', 5),
  ('sleep',      '趴睡',      -1,  '紀律', 6),
  ('talk',       '講話干擾',  -1,  '紀律', 7),
  ('no_homework','未帶作業',  -1,  '作業', 8);


-- ---------------------------------------------------------------------------
-- 9. hc_performance_records — 上課表現紀錄（累計制，同堂課同生可多筆）
-- ---------------------------------------------------------------------------

create table public.hc_performance_records (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.hc_lessons(id) on delete cascade,
  student_id uuid not null references public.hc_students(id) on delete cascade,
  item_id    uuid references public.hc_performance_items(id) on delete set null, -- null = 自由輸入
  label      text not null default '',                   -- 記錄當下的項目名稱快照
  points     numeric(5,1) not null,
  reason     text not null default '',
  created_by uuid references public.hc_teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index hc_performance_records_lesson_idx on public.hc_performance_records (lesson_id);
create index hc_performance_records_student_idx on public.hc_performance_records (student_id);


-- ---------------------------------------------------------------------------
-- 10. hc_groups / hc_group_members — 分組
-- ---------------------------------------------------------------------------

create table public.hc_groups (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.hc_classes(id) on delete cascade,
  name       text not null,
  color      text not null default '',
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),

  unique (class_id, name)
);

create table public.hc_group_members (
  group_id   uuid not null references public.hc_groups(id) on delete cascade,
  student_id uuid not null references public.hc_students(id) on delete cascade,
  is_leader  boolean not null default false,
  created_at timestamptz not null default now(),

  primary key (group_id, student_id)
);

create index hc_group_members_student_idx on public.hc_group_members (student_id);


-- ---------------------------------------------------------------------------
-- 11. hc_import_batches — Excel 名單匯入批次
-- ---------------------------------------------------------------------------

create table public.hc_import_batches (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid references public.hc_classes(id) on delete set null,
  teacher_id    uuid references public.hc_teachers(id) on delete set null,
  filename      text not null default '',
  strategy      text not null default 'upsert' check (strategy in ('upsert', 'replace', 'append')),
  status        text not null default 'running' check (status in ('running', 'success', 'failed')),
  row_count     integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error         text not null default '',
  summary       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index hc_import_batches_class_idx on public.hc_import_batches (class_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 12. hc_sync_log — Google Sheets 匯出紀錄（單向 Supabase → Sheets，手動觸發）
-- ---------------------------------------------------------------------------

create table public.hc_sync_log (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid references public.hc_classes(id) on delete set null,
  triggered_by   uuid references public.hc_teachers(id) on delete set null,
  scope          text not null check (scope in ('roster', 'attendance', 'performance', 'summary')),
  spreadsheet_id text not null default '',
  sheet_name     text not null default '',
  status         text not null default 'running' check (status in ('running', 'success', 'failed')),
  row_count      integer not null default 0,
  error          text not null default '',
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index hc_sync_log_class_idx on public.hc_sync_log (class_id, started_at desc);


-- ---------------------------------------------------------------------------
-- 13. hc_settings — 設定（可掛在教師或班級層級）
-- ---------------------------------------------------------------------------

create table public.hc_settings (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.hc_teachers(id) on delete cascade,
  class_id   uuid references public.hc_classes(id) on delete cascade,
  key        text not null,                              -- 例：sheets.spreadsheet_id
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index hc_settings_scope_key
  on public.hc_settings (
    coalesce(teacher_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(class_id,   '00000000-0000-0000-0000-000000000000'::uuid),
    key
  );

create trigger hc_settings_touch
  before update on public.hc_settings
  for each row execute function public.hc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 統計 view：學生總分 = 出缺席分 + 表現分
-- ---------------------------------------------------------------------------

create view public.hc_student_scores
with (security_invoker = true)
as
select
  s.id                                as student_id,
  s.class_id,
  s.student_no,
  s.seat_no,
  s.name,
  coalesce(a.attendance_points, 0)    as attendance_points,
  coalesce(p.performance_points, 0)   as performance_points,
  coalesce(a.attendance_points, 0) + coalesce(p.performance_points, 0) as total_points,
  coalesce(a.late_count, 0)           as late_count,
  coalesce(a.absent_count, 0)         as absent_count,
  coalesce(p.record_count, 0)         as performance_record_count
from public.hc_students s
left join (
  select
    student_id,
    sum(points)                                     as attendance_points,
    count(*) filter (where status = 'late')         as late_count,
    count(*) filter (where status = 'absent')       as absent_count
  from public.hc_attendance
  group by student_id
) a on a.student_id = s.id
left join (
  select student_id, sum(points) as performance_points, count(*) as record_count
  from public.hc_performance_records
  group by student_id
) p on p.student_id = s.id;


-- ---------------------------------------------------------------------------
-- 學生選位 RPC（免登入；anon 只被授權執行這三個函式，不能直接讀寫任何 table）
-- ---------------------------------------------------------------------------

-- 以 join_code 取得選位頁所需資料
create or replace function public.hc_seat_picking_info(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.hc_classes;
begin
  select * into v_class
  from public.hc_classes
  where join_code = p_code and is_active;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if not v_class.seat_picking_open then
    raise exception 'picking_closed' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'class', jsonb_build_object(
      'id',                 v_class.id,
      'name',               v_class.name,
      'seat_rows',          v_class.seat_rows,
      'seat_cols',          v_class.seat_cols,
      'disabled_seats',     v_class.disabled_seats,
      'require_student_no', v_class.seat_picking_require_student_no
    ),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'seat_no', s.seat_no, 'name', s.name)
                       order by s.seat_no nulls last, s.student_no)
      from public.hc_students s
      where s.class_id = v_class.id and s.is_active
    ), '[]'::jsonb),
    'occupied', coalesce((
      select jsonb_agg(jsonb_build_object('seat_row', a.seat_row, 'seat_col', a.seat_col, 'student_id', a.student_id))
      from public.hc_seat_assignments a
      where a.class_id = v_class.id
    ), '[]'::jsonb)
  );
end;
$$;

-- 學生選位（可改位，直到老師關閉選位）
create or replace function public.hc_claim_seat(
  p_code       text,
  p_student_id uuid,
  p_seat_row   smallint,
  p_seat_col   smallint,
  p_student_no text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class   public.hc_classes;
  v_student public.hc_students;
begin
  select * into v_class
  from public.hc_classes
  where join_code = p_code and is_active;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if not v_class.seat_picking_open then
    raise exception 'picking_closed' using errcode = 'P0002';
  end if;

  select * into v_student
  from public.hc_students
  where id = p_student_id and class_id = v_class.id and is_active;

  if not found then
    raise exception 'invalid_student' using errcode = 'P0003';
  end if;

  if v_class.seat_picking_require_student_no then
    if p_student_no is null
       or right(v_student.student_no, 3) <> right(trim(p_student_no), 3) then
      raise exception 'student_no_mismatch' using errcode = 'P0004';
    end if;
  end if;

  if p_seat_row < 1 or p_seat_row > v_class.seat_rows
     or p_seat_col < 1 or p_seat_col > v_class.seat_cols then
    raise exception 'seat_out_of_range' using errcode = 'P0005';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_class.disabled_seats) d
    where (d ->> 'row')::int = p_seat_row and (d ->> 'col')::int = p_seat_col
  ) then
    raise exception 'seat_disabled' using errcode = 'P0006';
  end if;

  begin
    insert into public.hc_seat_assignments (class_id, student_id, seat_row, seat_col, assigned_by)
    values (v_class.id, p_student_id, p_seat_row, p_seat_col, 'student')
    on conflict (class_id, student_id)
      do update set seat_row = excluded.seat_row,
                    seat_col = excluded.seat_col,
                    assigned_by = 'student';
  exception
    when unique_violation then
      raise exception 'seat_taken' using errcode = 'P0007';
  end;

  return jsonb_build_object(
    'student_id', p_student_id,
    'name',       v_student.name,
    'seat_row',   p_seat_row,
    'seat_col',   p_seat_col
  );
end;
$$;

-- 學生放棄座位
create or replace function public.hc_release_seat(p_code text, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.hc_classes;
begin
  select * into v_class
  from public.hc_classes
  where join_code = p_code and is_active;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if not v_class.seat_picking_open then
    raise exception 'picking_closed' using errcode = 'P0002';
  end if;

  delete from public.hc_seat_assignments
  where class_id = v_class.id and student_id = p_student_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.hc_teachers            enable row level security;
alter table public.hc_classes             enable row level security;
alter table public.hc_students            enable row level security;
alter table public.hc_seat_assignments    enable row level security;
alter table public.hc_lessons             enable row level security;
alter table public.hc_attendance_statuses enable row level security;
alter table public.hc_attendance          enable row level security;
alter table public.hc_performance_items   enable row level security;
alter table public.hc_performance_records enable row level security;
alter table public.hc_groups              enable row level security;
alter table public.hc_group_members       enable row level security;
alter table public.hc_import_batches      enable row level security;
alter table public.hc_sync_log            enable row level security;
alter table public.hc_settings            enable row level security;

-- 教師：只看得到自己
create policy hc_teachers_self on public.hc_teachers
  for select to authenticated
  using (id = auth.uid() or public.hc_is_admin());

create policy hc_teachers_update_self on public.hc_teachers
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 班級：擁有者全權
create policy hc_classes_owner on public.hc_classes
  for all to authenticated
  using (teacher_id = auth.uid() or public.hc_is_admin())
  with check (teacher_id = auth.uid() or public.hc_is_admin());

-- 以 class_id 掛勾的表：一律走 hc_owns_class()
create policy hc_students_owner on public.hc_students
  for all to authenticated
  using (public.hc_owns_class(class_id)) with check (public.hc_owns_class(class_id));

create policy hc_seat_assignments_owner on public.hc_seat_assignments
  for all to authenticated
  using (public.hc_owns_class(class_id)) with check (public.hc_owns_class(class_id));

create policy hc_lessons_owner on public.hc_lessons
  for all to authenticated
  using (public.hc_owns_class(class_id)) with check (public.hc_owns_class(class_id));

create policy hc_groups_owner on public.hc_groups
  for all to authenticated
  using (public.hc_owns_class(class_id)) with check (public.hc_owns_class(class_id));

create policy hc_import_batches_owner on public.hc_import_batches
  for all to authenticated
  using (teacher_id = auth.uid() or public.hc_is_admin())
  with check (teacher_id = auth.uid() or public.hc_is_admin());

create policy hc_sync_log_owner on public.hc_sync_log
  for all to authenticated
  using (triggered_by = auth.uid() or public.hc_is_admin())
  with check (triggered_by = auth.uid() or public.hc_is_admin());

-- 以 lesson_id 掛勾的表
create policy hc_attendance_owner on public.hc_attendance
  for all to authenticated
  using (exists (select 1 from public.hc_lessons l
                 where l.id = lesson_id and public.hc_owns_class(l.class_id)))
  with check (exists (select 1 from public.hc_lessons l
                      where l.id = lesson_id and public.hc_owns_class(l.class_id)));

create policy hc_performance_records_owner on public.hc_performance_records
  for all to authenticated
  using (exists (select 1 from public.hc_lessons l
                 where l.id = lesson_id and public.hc_owns_class(l.class_id)))
  with check (exists (select 1 from public.hc_lessons l
                      where l.id = lesson_id and public.hc_owns_class(l.class_id)));

-- 以 group_id 掛勾
create policy hc_group_members_owner on public.hc_group_members
  for all to authenticated
  using (exists (select 1 from public.hc_groups g
                 where g.id = group_id and public.hc_owns_class(g.class_id)))
  with check (exists (select 1 from public.hc_groups g
                      where g.id = group_id and public.hc_owns_class(g.class_id)));

-- 字典表：全體教師可讀；表現項目可自建自管，系統預設列（teacher_id is null）唯讀
create policy hc_attendance_statuses_read on public.hc_attendance_statuses
  for select to authenticated using (true);

create policy hc_performance_items_read on public.hc_performance_items
  for select to authenticated
  using (teacher_id is null or teacher_id = auth.uid() or public.hc_is_admin());

create policy hc_performance_items_write on public.hc_performance_items
  for all to authenticated
  using (teacher_id = auth.uid() or public.hc_is_admin())
  with check (teacher_id = auth.uid() or public.hc_is_admin());

-- 設定
create policy hc_settings_owner on public.hc_settings
  for all to authenticated
  using (teacher_id = auth.uid()
         or (class_id is not null and public.hc_owns_class(class_id))
         or public.hc_is_admin())
  with check (teacher_id = auth.uid()
              or (class_id is not null and public.hc_owns_class(class_id))
              or public.hc_is_admin());


-- ---------------------------------------------------------------------------
-- 權限：anon 對本系統的 table 一律無權，只能執行選位 RPC
--   （僅收束 hc_ 開頭的物件，不影響共用專案內其他 app）
-- ---------------------------------------------------------------------------

revoke all on table
  public.hc_teachers, public.hc_classes, public.hc_students,
  public.hc_seat_assignments, public.hc_lessons, public.hc_attendance_statuses,
  public.hc_attendance, public.hc_performance_items, public.hc_performance_records,
  public.hc_groups, public.hc_group_members, public.hc_import_batches,
  public.hc_sync_log, public.hc_settings
from anon;

revoke all on public.hc_student_scores from anon;

-- 註：hc_is_admin() / hc_owns_class() 刻意保留 PUBLIC 的預設 EXECUTE 權限。
--     RLS policy 的運算式是以「呼叫者的身分」執行的，若對 PUBLIC 收回 EXECUTE，
--     authenticated 查詢自己的資料時會直接噴 permission denied（已實測驗證）。
--     兩者對 anon 而言 auth.uid() 為 null，一律回傳 false，不構成資料外洩。

grant execute on function public.hc_ensure_teacher() to authenticated;

grant execute on function
  public.hc_seat_picking_info(text),
  public.hc_claim_seat(text, uuid, smallint, smallint, text),
  public.hc_release_seat(text, uuid)
to anon, authenticated;
