-- =============================================================================
-- 座位模型改為「分組 U 字型」
--
-- 教室實際佈置是分組討論桌，不是整齊的列×行格子：
--   * 標準 7 組（308 班 8 組）
--   * 每組最多 5 人，U 字型：左 2、右 2、桌子後端 1
--   * 上排與下排分佈（7 組＝上 3 下 4）
--
-- 因此座位的識別方式由 (seat_row, seat_col) 改為 (group_no, seat_slot)。
-- 建立班級時改填「組數」與「每組人數上限」，不再需要列數行數。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. hc_classes：格子尺寸 → 組數／每組人數
-- ---------------------------------------------------------------------------

alter table public.hc_classes
  add column group_count    smallint not null default 7 check (group_count between 1 and 12),
  add column group_capacity smallint not null default 5 check (group_capacity between 1 and 10);

alter table public.hc_classes
  drop column seat_rows,
  drop column seat_cols,
  drop column disabled_seats;

comment on column public.hc_classes.group_count is '分組數，標準 7 組，308 班為 8 組';
comment on column public.hc_classes.group_capacity is '每組人數上限，U 字型座位標準為 5（左2 右2 後端1）';

-- ---------------------------------------------------------------------------
-- 2. hc_seat_assignments：座標 → 組別＋組內位置
--    seat_slot 的排列語意由前端決定（左側由上而下、右側由上而下、最後為後端），
--    資料庫只保證同一組內不重複。
-- ---------------------------------------------------------------------------

alter table public.hc_seat_assignments
  add column group_no  smallint,
  add column seat_slot smallint;

-- 目前尚無座位資料；此處仍以 NOT NULL 收緊，避免日後寫入不完整的座位
update public.hc_seat_assignments set group_no = 1, seat_slot = 1 where group_no is null;

alter table public.hc_seat_assignments
  alter column group_no  set not null,
  alter column seat_slot set not null,
  add constraint hc_seat_assignments_group_no_positive  check (group_no >= 1),
  add constraint hc_seat_assignments_seat_slot_positive check (seat_slot >= 1);

alter table public.hc_seat_assignments
  drop column seat_row,
  drop column seat_col;

alter table public.hc_seat_assignments
  add constraint hc_seat_assignments_unique_slot unique (class_id, group_no, seat_slot);

comment on column public.hc_seat_assignments.group_no is '第幾組，1 起算';
comment on column public.hc_seat_assignments.seat_slot is '組內第幾個位置，1 起算';
