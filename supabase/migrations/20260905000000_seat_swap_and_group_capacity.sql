-- =============================================================================
-- 座位兩項修正
--
-- 1. 對調座位：老師端原本直接 upsert（onConflict = class_id,student_id），
--    目標位子若已有別人，就會撞到 (class_id, group_no, seat_slot) 的唯一鍵，
--    出現 "duplicate key value violates unique constraint
--    hc_seat_assignments_unique_slot"。改為在單一 transaction 內同時交換兩人，
--    因此把該唯一鍵改成 DEFERRABLE，交換期間允許短暫重複。
--
-- 2. 每組人數可個別加位：班級人數超過 組數 × 每組上限 時（例：309 班 36 人，
--    7 組 × 5 = 35），需要把後排某一組擴充 1 個座位。以 jsonb 覆寫表記錄，
--    未列出的組別沿用 hc_classes.group_capacity。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 每組人數覆寫：{"6": 6} 代表第 6 組上限 6 人
-- ---------------------------------------------------------------------------

alter table public.hc_classes
  add column group_capacity_overrides jsonb not null default '{}'::jsonb;

alter table public.hc_classes
  add constraint hc_classes_capacity_overrides_object
    check (jsonb_typeof(group_capacity_overrides) = 'object');

comment on column public.hc_classes.group_capacity_overrides is
  '個別組別的人數上限覆寫，鍵為組號字串、值為人數；未列出者沿用 group_capacity';

-- 取某一組的實際人數上限
create or replace function public.hc_group_capacity(
  p_class public.hc_classes,
  p_group_no smallint
)
returns smallint
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(p_class.group_capacity_overrides ->> p_group_no::text, '')::smallint,
    p_class.group_capacity
  );
$$;

-- 與 hc_owns_class 同樣的理由：RLS／RPC 內以呼叫者身分執行，需保留 EXECUTE
grant execute on function public.hc_group_capacity(public.hc_classes, smallint)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 唯一鍵改為可延遲，讓交換座位能在同一個 transaction 內完成
--    仍是 INITIALLY IMMEDIATE，一般寫入的錯誤時機不變；
--    只有 hc_move_seat 內會 SET CONSTRAINTS ... DEFERRED。
-- ---------------------------------------------------------------------------

alter table public.hc_seat_assignments
  drop constraint hc_seat_assignments_unique_slot;

alter table public.hc_seat_assignments
  add constraint hc_seat_assignments_unique_slot
    unique (class_id, group_no, seat_slot) deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- 3. 老師端調位／對調
--
-- 刻意使用 SECURITY INVOKER（預設）：以呼叫的教師身分執行，RLS 照常生效，
-- 老師只能動自己班級的座位。
-- ---------------------------------------------------------------------------

create or replace function public.hc_move_seat(
  p_class_id   uuid,
  p_student_id uuid,
  p_group_no   smallint,
  p_seat_slot  smallint
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_class    public.hc_classes;
  v_cap      smallint;
  v_target   public.hc_seat_assignments;
  v_current  public.hc_seat_assignments;
  v_swapped  uuid := null;
begin
  -- RLS 讓老師只看得到自己的班級
  select * into v_class from public.hc_classes where id = p_class_id;
  if not found then
    raise exception 'class_not_found' using errcode = 'P0006';
  end if;

  if not exists (
    select 1 from public.hc_students
    where id = p_student_id and class_id = p_class_id and is_active
  ) then
    raise exception 'invalid_student' using errcode = 'P0003';
  end if;

  v_cap := public.hc_group_capacity(v_class, p_group_no);
  if p_group_no < 1 or p_group_no > v_class.group_count
     or p_seat_slot < 1 or p_seat_slot > v_cap then
    raise exception 'seat_out_of_range' using errcode = 'P0005';
  end if;

  -- 交換的中間狀態會讓兩人短暫佔到同一格，因此延後檢查到 commit
  set constraints public.hc_seat_assignments_unique_slot deferred;

  select * into v_current from public.hc_seat_assignments
  where class_id = p_class_id and student_id = p_student_id;

  select * into v_target from public.hc_seat_assignments
  where class_id = p_class_id and group_no = p_group_no and seat_slot = p_seat_slot;

  if found and v_target.student_id = p_student_id then
    -- 點回自己原本的位子，不做事
    return jsonb_build_object('student_id', p_student_id, 'group_no', p_group_no,
                              'seat_slot', p_seat_slot, 'swapped_with', null);
  end if;

  if v_target.id is not null then
    if v_current.id is null then
      -- 被移動的學生原本沒有座位，硬塞會把目標學生擠掉，因此擋下來
      raise exception 'seat_taken' using errcode = 'P0007';
    end if;

    -- 兩人對調
    update public.hc_seat_assignments
      set group_no = v_current.group_no, seat_slot = v_current.seat_slot,
          assigned_by = 'teacher'
      where id = v_target.id;
    v_swapped := v_target.student_id;
  end if;

  if v_current.id is null then
    insert into public.hc_seat_assignments (class_id, student_id, group_no, seat_slot, assigned_by)
    values (p_class_id, p_student_id, p_group_no, p_seat_slot, 'teacher');
  else
    update public.hc_seat_assignments
      set group_no = p_group_no, seat_slot = p_seat_slot, assigned_by = 'teacher'
      where id = v_current.id;
  end if;

  return jsonb_build_object('student_id', p_student_id, 'group_no', p_group_no,
                            'seat_slot', p_seat_slot, 'swapped_with', v_swapped);
end;
$$;

revoke all on function public.hc_move_seat(uuid, uuid, smallint, smallint) from public, anon;
grant execute on function public.hc_move_seat(uuid, uuid, smallint, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 學生選位頁跟著吃每組覆寫
--    （選位關閉後只剩教師後台能調位，這裡只影響開放期間的可選範圍）
-- ---------------------------------------------------------------------------

create or replace function public.hc_seat_picking_info(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_class public.hc_classes;
begin
  select * into v_class
  from public.hc_classes
  where join_code = p_code and is_active;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if not v_class.seat_picking_open then
    raise exception 'picking_closed' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'class', jsonb_build_object(
      'id',                       v_class.id,
      'name',                     v_class.name,
      'group_count',              v_class.group_count,
      'group_capacity',           v_class.group_capacity,
      'group_capacity_overrides', v_class.group_capacity_overrides,
      'require_student_no',       v_class.seat_picking_require_student_no
    ),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'seat_no', s.seat_no, 'name', s.name)
                       order by s.seat_no nulls last, s.student_no)
      from public.hc_students s
      where s.class_id = v_class.id and s.is_active
    ), '[]'::jsonb),
    'occupied', coalesce((
      select jsonb_agg(jsonb_build_object(
               'group_no', a.group_no, 'seat_slot', a.seat_slot, 'student_id', a.student_id))
      from public.hc_seat_assignments a
      where a.class_id = v_class.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.hc_claim_seat(
  p_code       text,
  p_student_id uuid,
  p_group_no   smallint,
  p_seat_slot  smallint,
  p_student_no text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_class   public.hc_classes;
  v_student public.hc_students;
begin
  select * into v_class
  from public.hc_classes
  where join_code = p_code and is_active;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if not v_class.seat_picking_open then
    raise exception 'picking_closed' using errcode = 'P0002';
  end if;

  select * into v_student
  from public.hc_students
  where id = p_student_id and class_id = v_class.id and is_active;

  if not found then
    raise exception 'invalid_student' using errcode = 'P0003';
  end if;

  if v_class.seat_picking_require_student_no then
    if p_student_no is null
       or right(v_student.student_no, 3) <> right(trim(p_student_no), 3) then
      raise exception 'student_no_mismatch' using errcode = 'P0004';
    end if;
  end if;

  if p_group_no < 1 or p_group_no > v_class.group_count
     or p_seat_slot < 1
     or p_seat_slot > public.hc_group_capacity(v_class, p_group_no) then
    raise exception 'seat_out_of_range' using errcode = 'P0005';
  end if;

  begin
    insert into public.hc_seat_assignments (class_id, student_id, group_no, seat_slot, assigned_by)
    values (v_class.id, p_student_id, p_group_no, p_seat_slot, 'student')
    on conflict (class_id, student_id)
      do update set group_no    = excluded.group_no,
                    seat_slot   = excluded.seat_slot,
                    assigned_by = 'student';
  exception
    when unique_violation then
      raise exception 'seat_taken' using errcode = 'P0007';
  end;

  return jsonb_build_object(
    'student_id', p_student_id,
    'name',       v_student.name,
    'group_no',   p_group_no,
    'seat_slot',  p_seat_slot
  );
end;
$$;
