-- 教師端白名單（蕾蕾 2026-09-27 決定）
--
-- ── 為什麼 ─────────────────────────────────────────────────────────
-- hc_ensure_teacher() 原本對「任何登入成功、又不在學生名單上的人」都會建一列
-- 教師檔。新生、轉學生、名單還沒匯入的人一登入就變成老師，會看到教師後台的
-- 空殼。RLS 有把資料擋住（teacher_id = auth.uid()，實測讀不到任何別人的東西），
-- 但空殼本身不該出現，而且下面那條洞會讓它變成真的洞：
--
-- hc_classes 的 WITH CHECK 只檢查 teacher_id = auth.uid()，完全沒查 hc_teachers。
-- 也就是任何登入者都可以插入一列 teacher_id = 自己的班級；插進去之後
-- hc_owns_class() 對那個班就成立，接著可以加學生、開課堂、記出缺席。
-- 這條在 docs/待辦.md 掛了兩週，這次一起補。
--
-- ── 白名單放三個帳號（蕾蕾指定）───────────────────────────────
--   phyllis@hlhs.hlc.edu.tw      學校帳號，平常用的
--   phyllis1982.tw@gmail.com     救援帳號，忘記密碼時用
--   cindy923@hlhs.hlc.edu.tw     備份老師帳號
--
-- 放在資料表而不是寫死在函式裡：以後要加減人是改一列資料，不必再寫一個
-- migration，也留得下「誰、什麼時候、為什麼」。
--
-- ── 這個 migration 不碰什麼 ───────────────────────────────────────
-- 學生端完全不受影響：健康模組走 hc_is_known_student_email()，
-- 座位登記與點名走 join_code 的三支 SECURITY DEFINER 函式，兩條路都沒動。

-- ---------------------------------------------------------------------------
-- 一、白名單
-- ---------------------------------------------------------------------------
create table if not exists public.hc_teacher_allowlist (
  email    text primary key,
  note     text,
  added_at timestamptz not null default now()
);

comment on table public.hc_teacher_allowlist is
  '能使用教師端的帳號。email 一律小寫；沒有任何 RLS policy，只有 SECURITY DEFINER 函式碰得到';

alter table public.hc_teacher_allowlist enable row level security;
-- 刻意不建任何 policy：authenticated 讀不到這張表，也就看不到有哪些帳號

-- Supabase 對 public schema 的新表有預設授權，anon 與 authenticated 會自動
-- 拿到整套 SELECT/INSERT/UPDATE/DELETE。RLS 沒有 policy 所以實際上進不去，
-- 但這種授權留著，等於下一個人只要不小心加一條 policy，名單就出去了。
-- 這張表只需要被 SECURITY DEFINER 函式（以擁有者身分執行）讀到。
revoke all on public.hc_teacher_allowlist from anon, authenticated;

insert into public.hc_teacher_allowlist (email, note) values
  ('phyllis@hlhs.hlc.edu.tw',   '黃雅蕾・學校帳號'),
  ('phyllis1982.tw@gmail.com',  '黃雅蕾・救援帳號'),
  ('cindy923@hlhs.hlc.edu.tw',  '蔡欣恬・備份老師帳號')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 二、判定函式
--
-- 比對的是 JWT 裡的 email，不是 hc_teachers 那一列——那一列本身就是要被
-- 這個函式決定能不能存在的東西，拿它當依據會變成循環論證。
-- 兩邊都轉小寫：Google 回來的 email 大小寫不保證與當初輸入的一致。
-- ---------------------------------------------------------------------------
create or replace function public.hc_is_allowed_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.hc_teacher_allowlist a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

comment on function public.hc_is_allowed_teacher() is
  '登入者的 email 在教師白名單上嗎。學生與校外帳號一律 false';

revoke execute on function public.hc_is_allowed_teacher() from public, anon;
grant execute on function public.hc_is_allowed_teacher() to authenticated;

-- ---------------------------------------------------------------------------
-- 三、不在白名單上就不建教師檔
--
-- 原本的行為：任何人呼叫都會 insert ... on conflict do update。
-- 現在：先問白名單，不過就直接 raise，前端收到後顯示「沒有權限」。
-- 用 P0011 這個自訂 SQLSTATE，與 not_authenticated 的 P0010 分開，
-- 前端才分得出「沒登入」與「登入了但不是老師」。
-- ---------------------------------------------------------------------------
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

  if not public.hc_is_allowed_teacher() then
    raise exception 'not_a_teacher' using errcode = 'P0011';
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
-- 四、既有的教師列也要過白名單才讀得到
--
-- 前端判定身分的第一步是 findTeacher()，直接讀 hc_teachers 自己那一列。
-- 只擋 hc_ensure_teacher() 的話，先前誤建的列仍然會讓那個帳號被認成老師。
-- 目前三列都在白名單上，這條是為了「以後」而補的。
-- ---------------------------------------------------------------------------
drop policy if exists hc_teachers_self on public.hc_teachers;
create policy hc_teachers_self on public.hc_teachers
  for select to authenticated
  using ((id = auth.uid() and public.hc_is_allowed_teacher()) or public.hc_is_admin());

-- ---------------------------------------------------------------------------
-- 五、補上 hc_classes 的 WITH CHECK
--
-- USING 不動（讀取範圍照舊是自己的班），只收緊「建得了什麼」。
-- 沒有白名單就插不進任何一列班級，後面那串掛 class_id 的表也就跟著進不去。
-- ---------------------------------------------------------------------------
drop policy if exists hc_classes_owner on public.hc_classes;
create policy hc_classes_owner on public.hc_classes
  for all to authenticated
  using (teacher_id = auth.uid() or public.hc_is_admin())
  with check ((teacher_id = auth.uid() and public.hc_is_allowed_teacher())
              or public.hc_is_admin());
