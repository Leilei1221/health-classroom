-- hc_classes.grade_confirmed — 這個班的 grade 能不能拿來判年齡
--
-- BMI 門檻是年齡別的（見 src/health/rules.ts），要靠 grade 推出該查哪一列。
-- 但 grade 這個欄位不是每一筆都可信：
--   * 多元選修（例：基礎急救概論）本來就混年級，一個 grade 說不清楚
--   * 測試班沒有年級
-- 這種情況寧可不判，也不要套錯一組門檻到學生身上——
-- BMI 17 歲那列過重是 23.5、15 歲那列是 22.9，套錯會冤枉人。
--
-- 為什麼另開一欄而不是把 grade 設成 null：
-- 蕾蕾要保留基礎急救概論原本填的值，之後確認實際年級組成再決定，
-- 所以 grade 原樣不動，另外用這一欄標「先別信」。
alter table public.hc_classes
  add column if not exists grade_confirmed boolean not null default true;

comment on column public.hc_classes.grade_confirmed is
  'false = 年級未確認（多元選修混年級、或還沒查），前端不套年齡別門檻';
