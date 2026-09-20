-- 上課表現：再補兩個扣分項目，並讓「其他」可以填自己的理由
--
-- 1. requires_note 欄位
--    「其他」要讓老師當場打一行字（例：其他：手機放桌上），
--    所以需要一個「按下去要先問理由」的旗標。名字與作法照
--    hc_attendance_statuses.requires_note，同一個 schema 裡不要有兩套講法。
--    前端讀這個欄位決定要不要跳輸入框，不是在程式裡寫死 code = 'other'——
--    日後想讓別的項目也能填理由，改一列資料就好，不用改程式。
--
-- 2. 留垃圾、其他
--    都是紀律類、扣 1 分，排在桌椅未收（9）後面；「其他」放最後。
--
-- 3. 未帶作業 → 未帶作業/課本
--    只改字典裡的 label。已經記下去的舊紀錄不動：
--    hc_performance_records 在寫入時就把 label 複製了一份存起來，
--    那是當下的事實，不該被之後改名回頭蓋掉。

alter table public.hc_performance_items
  add column if not exists requires_note boolean not null default false;

comment on column public.hc_performance_items.requires_note is
  '按下去要先讓老師填一行理由；與 hc_attendance_statuses.requires_note 同義';

insert into public.hc_performance_items
  (code, label, default_points, category, sort_order, requires_note)
select v.code, v.label, v.pts, v.cat, v.ord, v.note
from (values
  ('litter', '留垃圾', -1::numeric, '紀律', 10::smallint, false),
  ('other',  '其他',   -1::numeric, '紀律', 11::smallint, true)
) as v(code, label, pts, cat, ord, note)
where not exists (
  select 1 from public.hc_performance_items p
  where p.teacher_id is null and p.code = v.code
);

-- 只在還是舊字串時才改，重跑不會蓋掉之後的人工修改
update public.hc_performance_items
   set label = '未帶作業/課本'
 where teacher_id is null and code = 'no_homework' and label = '未帶作業';
