-- 健康模組白名單：只有指定的班級用得到健康模組
--
-- 基礎急救概論是多元選修，上的是急救，跟健康管理無關，之後會有自己的模組；
-- 測試班也不該讓健康登記的 QR code 對它生效。
-- 改成白名單（預設關閉、要用的班自己開），而不是黑名單：
-- 以後新增班級時忘記設定，結果是「看不到」而不是「不小心全校都能填」。
--
-- 哪些班在白名單裡從班級管理的編輯畫面勾選，不寫在程式裡。

alter table public.hc_classes
  add column if not exists health_enabled boolean not null default false;

comment on column public.hc_classes.health_enabled is
  '健康模組白名單。true 才看得到健康登記與自我檢測；預設 false，新班要自己開';

-- ---------------------------------------------------------------------------
-- 學生端：我的班有沒有開健康模組
--
-- 學生讀不到 hc_classes（RLS 只開給帶班的老師），所以要一支 SECURITY DEFINER
-- 幫他問。刻意做成只回一個布林值，不回班級資料——這支函式的用途只有
-- 「要不要顯示健康模組」，不需要也不應該讓學生看到班級表的內容。
-- ---------------------------------------------------------------------------
create or replace function public.hc_health_enabled_for_me()
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.hc_students s
    join public.hc_classes c on c.id = s.class_id
    where coalesce(s.login_email, s.email) = auth.jwt() ->> 'email'
      and s.is_active
      and c.is_active
      and c.health_enabled
  );
$function$;

revoke execute on function public.hc_health_enabled_for_me() from public, anon;
grant  execute on function public.hc_health_enabled_for_me() to authenticated;

-- ---------------------------------------------------------------------------
-- 寫入端也要擋，不能只藏按鈕
--
-- hc_health_measurement 與 hc_health_selfcheck 的 WITH CHECK 是
--   (auth.jwt() ->> 'email') = student_email and hc_is_known_student_email(...)
-- 原本的 hc_is_known_student_email 只問「名單上有沒有這個人」，
-- 所以選修班的學生只要知道網址，仍然寫得進去。前端藏入口是方便，
-- 這裡才是真的擋住。
--
-- 順帶補上 s.is_active 與 c.is_active：原本的版本兩個都沒查，
-- 已經停用的學生、上學期的班級都算「名單上的人」。
-- ---------------------------------------------------------------------------
create or replace function public.hc_is_known_student_email(p_email text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.hc_students s
    join public.hc_classes c on c.id = s.class_id
    where coalesce(s.login_email, s.email) = p_email
      and s.is_active
      and c.is_active
      and c.health_enabled
  );
$function$;
