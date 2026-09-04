-- =============================================================================
-- 學生查詢自己的名單資料
--
-- 學生對 hc_students / hc_classes 沒有任何讀取權限（那兩張表的 policy 只給教師），
-- 但健康登記頁需要顯示「你是誰、哪一班、座號幾號」，並用學年度學期組出 semester。
-- 因此開一個 SECURITY DEFINER 函式，只回傳「email 等於呼叫者本人」的列。
--
-- 這個函式同時也是前端判斷身分的依據：查得到 = 學生，查不到 = 教師。
-- 沒有它的話，AuthProvider 會對每個登入者都呼叫 hc_ensure_teacher()，
-- 學生一登入就會被建成教師。
-- =============================================================================

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
         s.student_no, s.seat_no, s.name, s.email
  from public.hc_students s
  join public.hc_classes c on c.id = s.class_id
  where s.email = auth.jwt() ->> 'email'
    and s.is_active
    and c.is_active
  order by c.academic_year desc, c.semester desc, c.name;
$$;

revoke execute on function public.hc_my_student_profile() from public, anon;
grant  execute on function public.hc_my_student_profile() to authenticated;
