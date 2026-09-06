-- =============================================================================
-- 還原 hc_students.email 為 generated column
--
-- 這個欄位在 20260904000000 建立時是 generated always ... stored，
-- 但後來在資料庫後台被執行過 ALTER COLUMN email DROP EXPRESSION，變成普通欄位。
--
-- 症狀是無聲的：既有資料仍在（所以看不出異狀），但此後新增的學生 email 會是
-- NULL，那些學生登入健康頁會被 hc_is_known_student_email() 判定成「不在名單上」，
-- 而且不會有任何錯誤訊息。下學期匯入新名單時才會整批發作。
--
-- PostgreSQL 沒有把普通欄位改回 generated 的語法：
-- ALTER COLUMN ... SET EXPRESSION 只能修改「已經是 generated」欄位的公式，
-- 對普通欄位會噴 "column is not a generated column"（已實測）。
-- 因此只能砍掉重建。email 完全由 student_no 導出，重建不會遺失任何資訊。
--
-- 已確認沒有 view 或 policy 直接相依此欄位：相關 policy 走
-- hc_is_known_student_email() / hc_teaches_student_email()，
-- 兩者的函式本體是字串常值，不建立欄位相依。
-- =============================================================================

alter table public.hc_students drop column email;

alter table public.hc_students
  add column email text
  generated always as ('s' || student_no || '@hlhs.hlc.edu.tw') stored;

comment on column public.hc_students.email is
  '由學號生成的學校 Google 帳號，健康管理模組用來對應登入者；同一學生跨學期會有多列，故不唯一';

create index hc_students_email_idx on public.hc_students (email);
