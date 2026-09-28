-- 學生端內容管理（入口網站階段 2）
--
-- 蕾蕾 9/27 的需求：「我今天把 CPR 節奏的 GitHub 網址加進去，它就會自動出現在
-- 學生端。」這張表就是那件事的資料層——教師端貼一個網址，學生端首頁長出一張卡。
--
-- ── 設計上的四個決定 ───────────────────────────────────────────────
-- 1. 只存連結，不嵌內容。學生端用新分頁開啟，外部網站維持自己的樣子
--    （蕾蕾 9/27：「不需要去更改他們的風格」）。也避免 iframe 嵌任意外站
--    帶來的點擊劫持與 mixed content 問題。
-- 2. 只收 https。check constraint 擋在資料庫這一層，不是只靠前端。
-- 3. 「哪些班看得到」用 all_classes 加一張對照表：情境解謎只給多元選修，
--    三年級的同一頁不會有那張卡。用對照表而不是 uuid[]，是為了班級刪除時
--    能跟著 cascade，不留下對不到的 id。
-- 4. **與健康模組白名單無關。** 課程活動不是健康作業，
--    基礎急救概論沒有開 health_enabled，但那班的學生要看得到情境解謎。
--
-- ── 誰看得到什麼 ───────────────────────────────────────────────────
-- 教師：RLS，只碰得到自己建的連結（而且必須在教師白名單上）。
-- 學生：完全沒有這兩張表的權限，只能呼叫 hc_my_links()，
--       那支只回標題／網址／說明／排序，不回誰建的、也不回班級設定。
-- 未登入：什麼都沒有。

-- ---------------------------------------------------------------------------
-- 一、連結
-- ---------------------------------------------------------------------------
create table if not exists public.hc_links (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.hc_teachers(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 60),
  url         text not null check (url ~* '^https://[^[:space:]]+$' and length(url) <= 500),
  description text check (description is null or length(description) <= 120),
  visible     boolean  not null default true,
  sort_order  smallint not null default 0,
  /** true＝這位老師的所有班級都看得到；false＝看 hc_link_classes */
  all_classes boolean  not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.hc_links is
  '教師放給學生的外部連結（CPR 節奏、情境解謎等）。只存連結，學生端另開新分頁';
comment on column public.hc_links.all_classes is
  'true＝這位老師的所有班級；false＝只有 hc_link_classes 裡列出的班級';

drop trigger if exists hc_links_touch on public.hc_links;
create trigger hc_links_touch before update on public.hc_links
  for each row execute function public.hc_touch_updated_at();

create index if not exists hc_links_teacher_idx on public.hc_links (teacher_id, sort_order);

-- ---------------------------------------------------------------------------
-- 二、哪些班看得到（all_classes = false 時才看這張）
-- ---------------------------------------------------------------------------
create table if not exists public.hc_link_classes (
  link_id  uuid not null references public.hc_links(id)   on delete cascade,
  class_id uuid not null references public.hc_classes(id) on delete cascade,
  primary key (link_id, class_id)
);

comment on table public.hc_link_classes is
  '連結與班級的對照。班級刪掉時跟著 cascade，不會留下對不到的 id';

-- ---------------------------------------------------------------------------
-- 三、RLS：教師只碰得到自己的
-- ---------------------------------------------------------------------------
alter table public.hc_links       enable row level security;
alter table public.hc_link_classes enable row level security;

drop policy if exists hc_links_owner on public.hc_links;
create policy hc_links_owner on public.hc_links
  for all to authenticated
  using (teacher_id = auth.uid() or public.hc_is_admin())
  with check ((teacher_id = auth.uid() and public.hc_is_allowed_teacher())
              or public.hc_is_admin());

drop policy if exists hc_link_classes_owner on public.hc_link_classes;
create policy hc_link_classes_owner on public.hc_link_classes
  for all to authenticated
  using (exists (select 1 from public.hc_links l
                 where l.id = link_id and (l.teacher_id = auth.uid() or public.hc_is_admin())))
  with check (exists (select 1 from public.hc_links l
                      where l.id = link_id
                        and ((l.teacher_id = auth.uid() and public.hc_is_allowed_teacher())
                             or public.hc_is_admin()))
              -- 只能指定自己的班
              and exists (select 1 from public.hc_classes c
                          where c.id = class_id and (c.teacher_id = auth.uid() or public.hc_is_admin())));

-- 2026-09-27 的教訓：public schema 的新表，anon 與 authenticated 會自動拿到
-- 整套權限。authenticated 要留（教師端靠 RLS 限制列），anon 一律收掉。
revoke all on public.hc_links        from anon;
revoke all on public.hc_link_classes from anon;

-- ---------------------------------------------------------------------------
-- 四、學生端讀取
--
-- 學生對這兩張表沒有任何權限，只有這一支。回傳的欄位是刻意挑過的：
-- 不回 teacher_id、不回 all_classes、不回哪些班——那些是教師端的設定，
-- 學生沒有理由看到。
--
-- 一位學生可能同時在多門課的名單上（三年級本班＋多元選修），
-- 所以用 distinct 收斂，兩邊的連結都看得到。
-- ---------------------------------------------------------------------------
create or replace function public.hc_my_links()
returns table (id uuid, title text, url text, description text, sort_order smallint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct l.id, l.title, l.url, l.description, l.sort_order
  from public.hc_students s
  join public.hc_classes c on c.id = s.class_id
  join public.hc_links   l on l.teacher_id = c.teacher_id
  -- 比對的寫法與 hc_my_student_profile／hc_is_known_student_email 一致
  -- （coalesce(login_email, email) 直接比 JWT 的 email，沒有轉大小寫）。
  -- 要改成不分大小寫的話，三支要一起改，不能只改這一支。
  where coalesce(s.login_email, s.email) = auth.jwt() ->> 'email'
    and s.is_active
    and c.is_active
    and l.visible
    and (l.all_classes
         or exists (select 1 from public.hc_link_classes lc
                    where lc.link_id = l.id and lc.class_id = c.id))
  order by l.sort_order, l.title;
$$;

comment on function public.hc_my_links() is
  '登入學生看得到的課程活動連結。只回標題／網址／說明／排序，不回任何教師端設定';

revoke execute on function public.hc_my_links() from public, anon;
grant execute on function public.hc_my_links() to authenticated;
