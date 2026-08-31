-- =============================================================================
-- 配合分組座位改寫學生選位 RPC，並新增名單匯入 RPC
-- =============================================================================

-- 參數改變，需先移除舊版
drop function if exists public.hc_claim_seat(text, uuid, smallint, smallint, text);
drop function if exists public.hc_seat_picking_info(text);

-- ---------------------------------------------------------------------------
-- 學生選位頁資料（免登入，需正確 join_code）
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
      'id',                 v_class.id,
      'name',               v_class.name,
      'group_count',        v_class.group_count,
      'group_capacity',     v_class.group_capacity,
      'require_student_no', v_class.seat_picking_require_student_no
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

-- ---------------------------------------------------------------------------
-- 學生選位／改位
-- ---------------------------------------------------------------------------
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
     or p_seat_slot < 1 or p_seat_slot > v_class.group_capacity then
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

-- ---------------------------------------------------------------------------
-- Excel 名單匯入：依「班級」欄自動建立班級並寫入學生
--
-- 以單一 jsonb payload 傳入，讓每個班級可以有各自的組數
-- （標準 7 組，308 班 8 組），不必所有班共用同一個設定。
--
-- payload 形狀：
--   {
--     "academic_year": 115, "semester": 1, "filename": "名單.xlsx",
--     "default_group_count": 7, "default_group_capacity": 5,
--     "classes": [ {"name":"308","group_count":8,"group_capacity":5} ],  -- 覆寫，可省略
--     "rows":    [ {"class_name":"307","seat_no":"1","student_no":"410701","name":"王小明"} ]
--   }
--
-- 刻意使用 SECURITY INVOKER（預設）：整段以呼叫的教師身分執行，
-- 因此 RLS 照常生效，教師只能建立／修改自己的班級。
-- ---------------------------------------------------------------------------
create or replace function public.hc_import_roster(p_payload jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_teacher    uuid := auth.uid();
  v_year       smallint;
  v_semester   smallint;
  v_def_count  smallint;
  v_def_cap    smallint;
  v_rows       jsonb;
  v_batch_id   uuid;
  v_class_name text;
  v_class_id   uuid;
  v_override   jsonb;
  v_count      smallint;
  v_cap        smallint;
  v_row        jsonb;
  v_inserted   int := 0;
  v_updated    int := 0;
  v_new_class  boolean;
  v_classes    jsonb := '[]'::jsonb;
  v_class_new  int := 0;
begin
  if v_teacher is null then
    raise exception 'not_authenticated' using errcode = 'P0010';
  end if;

  v_year      := (p_payload ->> 'academic_year')::smallint;
  v_semester  := (p_payload ->> 'semester')::smallint;
  v_def_count := coalesce((p_payload ->> 'default_group_count')::smallint, 7);
  v_def_cap   := coalesce((p_payload ->> 'default_group_capacity')::smallint, 5);
  v_rows      := p_payload -> 'rows';

  if v_year is null or v_semester is null then
    raise exception 'missing_term' using errcode = 'P0012';
  end if;

  if jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) = 0 then
    raise exception 'empty_import' using errcode = 'P0011';
  end if;

  insert into public.hc_import_batches (teacher_id, filename, strategy, status, row_count)
  values (v_teacher, coalesce(p_payload ->> 'filename', ''), 'upsert', 'running',
          jsonb_array_length(v_rows))
  returning id into v_batch_id;

  for v_class_name in
    select distinct trim(r ->> 'class_name')
    from jsonb_array_elements(v_rows) r
    where coalesce(trim(r ->> 'class_name'), '') <> ''
    order by 1
  loop
    -- 該班是否有覆寫設定
    select c into v_override
    from jsonb_array_elements(coalesce(p_payload -> 'classes', '[]'::jsonb)) c
    where trim(c ->> 'name') = v_class_name
    limit 1;

    v_count := coalesce((v_override ->> 'group_count')::smallint, v_def_count);
    v_cap   := coalesce((v_override ->> 'group_capacity')::smallint, v_def_cap);

    select id into v_class_id
    from public.hc_classes
    where teacher_id = v_teacher
      and academic_year = v_year
      and semester = v_semester
      and name = v_class_name;

    v_new_class := v_class_id is null;

    if v_new_class then
      insert into public.hc_classes (
        teacher_id, academic_year, semester, name, group_count, group_capacity
      )
      values (v_teacher, v_year, v_semester, v_class_name, v_count, v_cap)
      returning id into v_class_id;
      v_class_new := v_class_new + 1;
    else
      -- 既有班級：只在明確指定覆寫時才更新組數，避免蓋掉老師手動調過的設定
      if v_override is not null then
        update public.hc_classes
           set group_count = v_count, group_capacity = v_cap
         where id = v_class_id;
      end if;
    end if;

    for v_row in
      select r from jsonb_array_elements(v_rows) r
      where trim(r ->> 'class_name') = v_class_name
        and coalesce(trim(r ->> 'student_no'), '') <> ''
        and coalesce(trim(r ->> 'name'), '') <> ''
    loop
      with upserted as (
        insert into public.hc_students (class_id, student_no, seat_no, name)
        values (
          v_class_id,
          trim(v_row ->> 'student_no'),
          nullif(trim(coalesce(v_row ->> 'seat_no', '')), '')::smallint,
          trim(v_row ->> 'name')
        )
        on conflict (class_id, student_no) do update
          set seat_no   = excluded.seat_no,
              name      = excluded.name,
              is_active = true
        returning (xmax = 0) as was_inserted
      )
      select
        v_inserted + count(*) filter (where was_inserted),
        v_updated  + count(*) filter (where not was_inserted)
      into v_inserted, v_updated
      from upserted;
    end loop;

    v_classes := v_classes || jsonb_build_object(
      'class_id', v_class_id, 'name', v_class_name,
      'created', v_new_class, 'group_count', v_count, 'group_capacity', v_cap
    );
  end loop;

  update public.hc_import_batches
     set status = 'success',
         inserted_count = v_inserted,
         updated_count  = v_updated,
         finished_at    = now(),
         summary = jsonb_build_object('classes', v_classes, 'classes_created', v_class_new)
   where id = v_batch_id;

  return jsonb_build_object(
    'batch_id',        v_batch_id,
    'classes',         v_classes,
    'classes_created', v_class_new,
    'inserted',        v_inserted,
    'updated',         v_updated
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 權限：anon 僅能執行選位相關 RPC；匯入僅限登入教師
-- ---------------------------------------------------------------------------
revoke execute on function public.hc_import_roster(jsonb) from public, anon;
grant  execute on function public.hc_import_roster(jsonb) to authenticated;

grant execute on function
  public.hc_seat_picking_info(text),
  public.hc_claim_seat(text, uuid, smallint, smallint, text)
to anon, authenticated;
