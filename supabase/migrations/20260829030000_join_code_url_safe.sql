-- join_code 會直接出現在學生選位連結／QR code 的網址中，
-- 但 base64 會產生 '+' 與 '/'，在網址路徑中會被誤解或需要跳脫。
-- 改用 base64url 字元集（'+/' → '-_'），並加上格式約束避免日後手動塞入不合法的值。

alter table public.hc_classes
  alter column join_code
  set default translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');

-- 既有資料一併轉為 URL-safe（目前尚無班級，此處為保險）
update public.hc_classes
   set join_code = translate(join_code, '+/', '-_')
 where join_code ~ '[+/]';

alter table public.hc_classes
  add constraint hc_classes_join_code_urlsafe
  check (join_code ~ '^[A-Za-z0-9_-]{8,64}$');
