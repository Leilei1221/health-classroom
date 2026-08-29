-- Supabase 對 public schema 設有 default privileges，會自動把新建函式的 EXECUTE
-- 明確授權給 anon（proacl 中會出現 anon=X）。因此僅對 PUBLIC 收回並不足夠，
-- 必須另外對 anon 明確 revoke，否則 anon 仍可呼叫。
revoke execute on function
  public.hc_is_admin(),
  public.hc_owns_class(uuid),
  public.hc_ensure_teacher(),
  public.hc_touch_updated_at()
from anon;

-- hc_touch_updated_at 是 trigger 函式，任何 API 角色都不需要直接呼叫
revoke execute on function public.hc_touch_updated_at() from public, authenticated;
