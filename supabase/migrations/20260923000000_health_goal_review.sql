-- SMART 目標與行動紀錄的教師批改。
--
-- 學生作業內容維持在 hc_health_goal / hc_health_checkin；
-- 這張表只保存教師批改狀態與給學生的建議。

create table if not exists public.hc_health_goal_review (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references public.hc_health_goal(id) on delete cascade,
  student_email   text not null,
  semester        text not null,
  status          text not null default 'reviewed'
                  check (status in ('reviewed', 'revise', 'approved')),
  feedback        text,
  reviewer_email  text not null default (auth.jwt() ->> 'email'),
  reviewed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (goal_id)
);

create index if not exists hc_health_goal_review_student_idx
  on public.hc_health_goal_review (student_email, semester);

drop trigger if exists hc_health_goal_review_touch on public.hc_health_goal_review;
create trigger hc_health_goal_review_touch
  before update on public.hc_health_goal_review
  for each row execute function public.hc_touch_updated_at();

alter table public.hc_health_goal_review enable row level security;

drop policy if exists hc_health_goal_review_student_read on public.hc_health_goal_review;
create policy hc_health_goal_review_student_read on public.hc_health_goal_review
  for select to authenticated
  using (auth.jwt() ->> 'email' = student_email);

drop policy if exists hc_health_goal_review_teacher_read on public.hc_health_goal_review;
create policy hc_health_goal_review_teacher_read on public.hc_health_goal_review
  for select to authenticated
  using (public.hc_teaches_student_email(student_email));

drop policy if exists hc_health_goal_review_teacher_insert on public.hc_health_goal_review;
create policy hc_health_goal_review_teacher_insert on public.hc_health_goal_review
  for insert to authenticated
  with check (
    public.hc_teaches_student_email(student_email)
    and auth.jwt() ->> 'email' = reviewer_email
    and exists (
      select 1
      from public.hc_health_goal g
      where g.id = goal_id
        and g.student_email = student_email
        and g.semester = semester
    )
  );

drop policy if exists hc_health_goal_review_teacher_update on public.hc_health_goal_review;
create policy hc_health_goal_review_teacher_update on public.hc_health_goal_review
  for update to authenticated
  using (public.hc_teaches_student_email(student_email))
  with check (
    public.hc_teaches_student_email(student_email)
    and auth.jwt() ->> 'email' = reviewer_email
  );

revoke all on table public.hc_health_goal_review from anon;
grant select, insert, update on table public.hc_health_goal_review to authenticated;
