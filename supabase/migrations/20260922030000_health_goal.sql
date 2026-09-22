-- SMART 目標作業收件。
--
-- 只新增資料表與 RLS，不動既有健康量測、自我檢測與紅旗規則。
-- 目前前端以「每位學生本學期一份 SMART 作業」寫入 goal_no = 1；
-- goal_no 保留 1-3，是為了後續若要拆成最多三個獨立目標時不用改表。

create table if not exists public.hc_health_goal (
  id                 uuid primary key default gen_random_uuid(),
  student_email      text not null,
  semester           text not null,
  goal_no            smallint not null default 1 check (goal_no between 1 and 3),

  selected_options   jsonb not null default '[]'::jsonb,
  direction          text not null,
  s_action           text not null,
  m_method           text not null,
  frequency          text not null,
  target_per_week    smallint not null default 3 check (target_per_week between 3 and 7),
  confidence         smallint not null default 7 check (confidence between 0 and 10),

  why                text,
  people             text,
  place              text,
  resources          text,
  reward             text,
  week1              text,
  week2              text,
  week3              text,
  week4              text,

  ai_prompt          text,
  ai_ask             text,
  ai_useful          text,
  ai_changed         text,
  wsq_watch          text,
  wsq_summary        text,
  wsq_question       text,

  confirmed          boolean not null default false,
  status             text not null default 'active'
                     check (status in ('draft', 'active', 'done', 'dropped')),
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (student_email, semester, goal_no)
);

create index if not exists hc_health_goal_email_idx
  on public.hc_health_goal (student_email, semester);

create index if not exists hc_health_goal_submitted_idx
  on public.hc_health_goal (semester, submitted_at desc);

drop trigger if exists hc_health_goal_touch on public.hc_health_goal;
create trigger hc_health_goal_touch
  before update on public.hc_health_goal
  for each row execute function public.hc_touch_updated_at();

alter table public.hc_health_goal enable row level security;

drop policy if exists hc_health_goal_student_own on public.hc_health_goal;
create policy hc_health_goal_student_own on public.hc_health_goal
  for all to authenticated
  using (auth.jwt() ->> 'email' = student_email)
  with check (
    auth.jwt() ->> 'email' = student_email
    and public.hc_is_known_student_email(student_email)
  );

drop policy if exists hc_health_goal_teacher_read on public.hc_health_goal;
create policy hc_health_goal_teacher_read on public.hc_health_goal
  for select to authenticated
  using (public.hc_teaches_student_email(student_email));

revoke all on table public.hc_health_goal from anon;
