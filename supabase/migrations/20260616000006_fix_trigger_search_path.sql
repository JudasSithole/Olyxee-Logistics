-- Fix handle_new_user trigger: set search_path=public so generate_id() resolves
-- and explicitly pass id in INSERT to avoid NULL from unresolved default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_business_id   text;
  v_business_name text;
  v_slug          text;
  v_slug_base     text;
  v_suffix        int := 0;
  v_full_name     text;
begin
  v_full_name     := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_business_name := new.raw_user_meta_data->>'business_name';

  if v_business_name is not null and v_business_name <> '' then
    v_slug_base := lower(regexp_replace(v_business_name, '[^a-z0-9]+', '-', 'gi'));
    v_slug_base := trim(both '-' from v_slug_base);
    v_slug      := v_slug_base;

    loop
      if not exists (select 1 from businesses where slug = v_slug) then
        exit;
      end if;
      v_suffix := v_suffix + 1;
      v_slug   := v_slug_base || '-' || v_suffix;
    end loop;

    insert into businesses (id, name, slug, support_email)
    values (
      generate_id(),
      v_business_name,
      v_slug,
      coalesce(new.email, '')
    )
    returning id into v_business_id;
  end if;

  insert into profiles (id, email, full_name, business_id, role)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    v_business_id,
    case when v_business_id is not null then 'owner' else 'staff' end
  )
  on conflict (id) do update set
    business_id = coalesce(excluded.business_id, profiles.business_id),
    full_name   = case when excluded.full_name <> '' then excluded.full_name else profiles.full_name end,
    email       = case when excluded.email <> '' then excluded.email else profiles.email end,
    role        = case when v_business_id is not null then 'owner' else profiles.role end;

  return new;
end;
$$;
