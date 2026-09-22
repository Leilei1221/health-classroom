-- 打卡紀錄。
--
-- 預設介面提供 1-4 週，學生若想延伸可以新增週次。
-- 不儲存照片；照片上傳與 storage 權限之後另做。

create table if not exists public.hc_health_checkin_week (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references public.hc_health_goal(id) on delete cascade,
  student_email   text not null,
  semester        text not null,
  week_no         smallint not null check (week_no between 1 and 20),
  week_start_date date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (goal_id, week_no)
);

create index if not exists hc_health_checkin_week_student_idx
  on public.hc_health_checkin_week (student_email, semester, week_no);

drop trigger if exists hc_health_checkin_week_touch on public.hc_health_checkin_week;
create trigger hc_health_checkin_week_touch
  before update on public.hc_health_checkin_week
  for each row execute function public.hc_touch_updated_at();

create table if not exists public.hc_health_checkin (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references public.hc_health_goal(id) on delete cascade,
  student_email  text not null,
  semester       text not null,
  week_no        smallint not null default 1 check (week_no between 1 and 20),
  day_no         smallint not null check (day_no between 1 and 7),
  check_date     date not null default current_date,
  status         text not null check (status in ('done', 'partial', 'rest')),
  action_done    text,
  minutes        integer check (minutes is null or (minutes >= 0 and minutes <= 1440)),
  note           text,
  evidence_note  text,
  encouragement  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (goal_id, week_no, day_no)
);

create index if not exists hc_health_checkin_student_idx
  on public.hc_health_checkin (student_email, semester, week_no, day_no);

create index if not exists hc_health_checkin_goal_idx
  on public.hc_health_checkin (goal_id, week_no, day_no);

drop trigger if exists hc_health_checkin_touch on public.hc_health_checkin;
create trigger hc_health_checkin_touch
  before update on public.hc_health_checkin
  for each row execute function public.hc_touch_updated_at();

alter table public.hc_health_checkin enable row level security;
alter table public.hc_health_checkin_week enable row level security;

drop policy if exists hc_health_checkin_week_student_own on public.hc_health_checkin_week;
create policy hc_health_checkin_week_student_own on public.hc_health_checkin_week
  for all to authenticated
  using (auth.jwt() ->> 'email' = student_email)
  with check (
    auth.jwt() ->> 'email' = student_email
    and public.hc_is_known_student_email(student_email)
    and exists (
      select 1
      from public.hc_health_goal g
      where g.id = goal_id
        and g.student_email = student_email
        and g.semester = semester
    )
  );

drop policy if exists hc_health_checkin_week_teacher_read on public.hc_health_checkin_week;
create policy hc_health_checkin_week_teacher_read on public.hc_health_checkin_week
  for select to authenticated
  using (public.hc_teaches_student_email(student_email));

drop policy if exists hc_health_checkin_student_own on public.hc_health_checkin;
create policy hc_health_checkin_student_own on public.hc_health_checkin
  for all to authenticated
  using (auth.jwt() ->> 'email' = student_email)
  with check (
    auth.jwt() ->> 'email' = student_email
    and public.hc_is_known_student_email(student_email)
    and exists (
      select 1
      from public.hc_health_goal g
      where g.id = goal_id
        and g.student_email = student_email
        and g.semester = semester
    )
  );

drop policy if exists hc_health_checkin_teacher_read on public.hc_health_checkin;
create policy hc_health_checkin_teacher_read on public.hc_health_checkin
  for select to authenticated
  using (public.hc_teaches_student_email(student_email));

revoke all on table
  public.hc_health_checkin_week,
  public.hc_health_checkin
from anon;
