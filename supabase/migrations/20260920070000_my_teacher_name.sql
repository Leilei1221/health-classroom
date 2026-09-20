-- 學生端要在關懷文案裡叫出授課教師的名字（規格書第五節：不要寫死）。
--
-- 學生讀不到 hc_teachers（policy 是 id = auth.uid()，只看得到自己那一列），
-- 所以要一支 SECURITY DEFINER 代問。
--
-- **回傳型別刻意是 text，不是一列資料。** 只有姓名，沒有 email、沒有 id、
-- 沒有 role。學生端需要的就只有那幾個字，多回傳的每一個欄位都是多出來的
-- 外洩面——這支函式是開給全校學生呼叫的。
create or replace function public.hc_my_teacher_name()
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select t.display_name
  from public.hc_students s
  join public.hc_classes c on c.id = s.class_id
  join public.hc_teachers t on t.id = c.teacher_id
  where coalesce(s.login_email, s.email) = auth.jwt() ->> 'email'
    and s.is_active and c.is_active and c.health_enabled
  order by c.academic_year desc, c.semester desc, c.name
  limit 1;
$function$;

revoke execute on function public.hc_my_teacher_name() from public, anon;
grant execute on function public.hc_my_teacher_name() to authenticated;
