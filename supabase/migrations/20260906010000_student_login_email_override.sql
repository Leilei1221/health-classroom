-- =============================================================================
-- hc_students.login_email：登入帳號覆寫
--
-- email 是由學號生成的 s{學號}@hlhs.hlc.edu.tw，這對絕大多數學生都成立，
-- 但有兩種情況對不上：
--   1. 老師要用自己的帳號實測學生流程（email 生不出教師信箱）
--   2. 少數學生的實際 Google 帳號與學號規則不符
-- 因此加一個可為 NULL 的覆寫欄位，比對時一律用 coalesce(login_email, email)。
--
-- 【為什麼 hc_my_student_profile 回傳的是 coalesce 後的值】
-- 這個值會被前端寫進 hc_health_measurement.student_email，
-- 而該表的 policy 是拿 auth.jwt() ->> 'email' 去比對 student_email。
-- 若這裡回傳生成的 email、人卻是用覆寫帳號登入，每一次寫入都會被 RLS 擋掉。
-- 兩邊必須是同一個值。
--
-- 【安全性】
-- 誰能設定：hc_students 的 policy 是 hc_owns_class()，所以只有班級擁有者
-- 能替自己班上的學生設定覆寫。教師本來就讀得到自己學生的健康資料，
-- 這不擴大教師的權限範圍。
-- 限定學校網域：避免把校外信箱對應到某位學生，讓校外帳號讀寫其健康資料。
-- 無法用約束防止的事：把 A 學生的覆寫設成 B 學生的真實信箱。
-- 那會讓 B 登入時同時對到兩列，hc_my_student_profile 取第一列，身分就錯了。
-- 設定前請確認覆寫的信箱不屬於其他學生。
-- =============================================================================

alter table public.hc_students
  add column login_email text;

alter table public.hc_students
  add constraint hc_students_login_email_format check (
    login_email is null
    or (
      login_email = lower(btrim(login_email))
      and login_email like '%@hlhs.hlc.edu.tw'
      and length(login_email) > length('@hlhs.hlc.edu.tw')
    )
  );

comment on column public.hc_students.login_email is
  '登入帳號覆寫；為 NULL 時沿用由學號生成的 email。限學校網域，只有班級擁有者能設定';

-- 身分比對一律走這個運算式，索引跟著它建
create index hc_students_login_lookup_idx
  on public.hc_students ((coalesce(login_email, email)));

-- ---------------------------------------------------------------------------
-- 三個比對函式改用 coalesce
-- ---------------------------------------------------------------------------

create or replace function public.hc_is_known_student_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.hc_students s
    where coalesce(s.login_email, s.email) = p_email
  );
$$;

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
    where coalesce(s.login_email, s.email) = p_email
      and (c.teacher_id = auth.uid() or public.hc_is_admin())
  );
$$;

create or replace function public.hc_my_student_profile()
returns table (
  student_id    uuid,
  class_id      uuid,
  class_name    text,
  academic_year smallint,
  semester      smallint,
  student_no    text,
  seat_no       smallint,
  name          text,
  email         text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, c.id, c.name, c.academic_year, c.semester,
         s.student_no, s.seat_no, s.name,
         -- 回傳「這個人實際登入用的信箱」，必須與 RLS 比對的值一致
         coalesce(s.login_email, s.email)
  from public.hc_students s
  join public.hc_classes c on c.id = s.class_id
  where coalesce(s.login_email, s.email) = auth.jwt() ->> 'email'
    and s.is_active
    and c.is_active
  order by c.academic_year desc, c.semester desc, c.name;
$$;

revoke execute on function public.hc_my_student_profile() from public, anon;
grant  execute on function public.hc_my_student_profile() to authenticated;
