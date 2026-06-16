-- ============================================================
-- Tracking ID Generation
-- 20260616000002_tracking_id_generation.sql
--
-- Generates human-readable tracking IDs like: "OL-20260616-A3F9"
-- using the business's custom prefix.
-- ============================================================

-- Generates a tracking ID of the form: <PREFIX>-<DATE>-<RANDOM>
-- e.g. OL-20260616-A3F9 or WASH-20260616-B12C
create or replace function generate_tracking_id(p_business_id text)
returns text
language plpgsql
as $$
declare
  v_prefix        text;
  v_date_part     text;
  v_random_part   text;
  v_tracking_id   text;
  v_attempts      int := 0;
begin
  -- Get the business prefix (fallback to 'ORD')
  select coalesce(tracking_id_prefix, 'ORD')
  into v_prefix
  from businesses
  where id = p_business_id;

  v_date_part := to_char(current_date, 'YYYYMMDD');

  loop
    v_random_part := upper(substring(encode(extensions.gen_random_bytes(3), 'hex') from 1 for 4));
    v_tracking_id := v_prefix || '-' || v_date_part || '-' || v_random_part;

    -- Check uniqueness
    if not exists (select 1 from orders where tracking_id = v_tracking_id) then
      return v_tracking_id;
    end if;

    v_attempts := v_attempts + 1;
    if v_attempts >= 10 then
      raise exception 'Could not generate unique tracking_id after 10 attempts';
    end if;
  end loop;
end;
$$;
