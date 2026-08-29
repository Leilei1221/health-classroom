-- 修正 Supabase security advisor 指出的問題（僅涉及 hc_ 物件）

-- 1. hc_touch_updated_at 缺少固定的 search_path
alter function public.hc_touch_updated_at() set search_path = public, pg_temp;

-- 2. hc_ensure_teacher / hc_is_admin / hc_owns_class 不應對 anon 開放。
--    初版註解誤稱「必須保留 PUBLIC 的 EXECUTE」，這個說法不正確：
--    真正需要 EXECUTE 的是「呼叫者的角色」，而 RLS policy 皆為 to authenticated，
--    因此對 PUBLIC 收回、再明確授權給 authenticated 即可，policy 照常運作。
revoke execute on function
  public.hc_is_admin(),
  public.hc_owns_class(uuid),
  public.hc_ensure_teacher()
from public;

grant execute on function
  public.hc_is_admin(),
  public.hc_owns_class(uuid),
  public.hc_ensure_teacher()
to authenticated;
