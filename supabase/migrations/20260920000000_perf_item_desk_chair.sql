-- 上課表現：新增扣分項目「桌椅未收」
--
-- teacher_id 為 null 代表系統預設項目，所有教師都看得到，
-- 與 init migration 裡既有的那八項同一種。
--
-- 為什麼走 migration 而不是從畫面上新增：
-- hc_performance_items 的 write policy 是
--   using / with check (teacher_id = auth.uid() or hc_is_admin())
-- 也就是老師只能建「自己的」項目，建不出 teacher_id is null 的系統預設項目。
-- 目前前端也沒有新增項目的介面（listPerformanceItems 只讀）。
--
-- 分類放「紀律」、扣 1 分，與使用手機／趴睡／講話干擾一致；
-- sort_order 9 接在未帶作業（8）後面，畫面上就排在扣分項目的最後一顆。
--
-- 用 not exists 而不是 on conflict：唯一索引是
-- (coalesce(teacher_id, '000…'::uuid), code) 這個運算式，
-- on conflict 要把運算式原樣寫對才會命中，寫錯會變成直接報錯或重複插入。
insert into public.hc_performance_items (code, label, default_points, category, sort_order)
select 'desk_chair', '桌椅未收', -1, '紀律', 9
where not exists (
  select 1 from public.hc_performance_items
  where teacher_id is null and code = 'desk_chair'
);
