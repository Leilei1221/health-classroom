-- 「未帶作業」的顯示名稱改為「未帶作業補交」
--
-- 這個項目改過兩次名：
--   init migration      未帶作業
--   20260920010000      未帶作業/課本   （2026-09-20 上午蕾蕾指定）
--   本 migration        未帶作業補交     （2026-09-20 下午蕾蕾指定，以最新為準）
-- 兩次都只改字典的 label，code 維持 no_homework 不動，
-- hc_performance_records 也不回頭改——那裡的 label 是寫入當下複製的一份，
-- 記的是老師當時按的是哪一顆按鈕，屬於歷史事實。
--
-- 條件式 update：兩種舊字串都接受，重跑不會蓋掉之後的人工修改。
update public.hc_performance_items
   set label = '未帶作業補交'
 where teacher_id is null
   and code = 'no_homework'
   and label in ('未帶作業', '未帶作業/課本');
