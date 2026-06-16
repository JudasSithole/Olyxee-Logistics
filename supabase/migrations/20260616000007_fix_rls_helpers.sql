-- Fix RLS helper functions: use search_path=public so they can resolve correctly.
-- The empty search_path was causing similar issues as the handle_new_user trigger.
create or replace function public.get_my_business_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select business_id from profiles where id = auth.uid();
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;
