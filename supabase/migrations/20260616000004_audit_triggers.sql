-- ============================================================
-- Audit Log Triggers
-- 20260616000004_audit_triggers.sql
--
-- Automatically writes to audit_logs when key records change.
-- Uses service_role context (security definer) so it can bypass RLS.
-- ============================================================

-- Generic audit-log writer function
create or replace function write_audit_log(
  p_business_id text,
  p_user_id     uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_old_value   jsonb default null,
  p_new_value   jsonb default null,
  p_metadata    jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    business_id, user_id, action, entity_type,
    entity_id, old_value, new_value, metadata
  ) values (
    p_business_id, p_user_id, p_action, p_entity_type,
    p_entity_id, p_old_value, p_new_value, p_metadata
  );
end;
$$;

-- ─── Trigger: orders status change ───────────────────────────────────────────
create or replace function audit_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.current_status is distinct from new.current_status then
    perform public.write_audit_log(
      new.business_id,
      auth.uid(),
      'order.status_changed',
      'order',
      new.id,
      jsonb_build_object('status', old.current_status),
      jsonb_build_object('status', new.current_status)
    );
  end if;
  return new;
end;
$$;

create trigger audit_order_status
  after update on orders
  for each row execute function audit_order_status_change();


-- ─── Trigger: customers created/deleted ──────────────────────────────────────
create or replace function audit_customer_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      new.business_id, auth.uid(),
      'customer.created', 'customer', new.id,
      null,
      jsonb_build_object('email', new.email, 'name', new.full_name)
    );
  elsif tg_op = 'DELETE' then
    perform public.write_audit_log(
      old.business_id, auth.uid(),
      'customer.deleted', 'customer', old.id,
      jsonb_build_object('email', old.email, 'name', old.full_name),
      null
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_customers
  after insert or delete on customers
  for each row execute function audit_customer_changes();


-- ─── Trigger: team member role change ────────────────────────────────────────
create or replace function audit_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is distinct from new.role then
    perform public.write_audit_log(
      new.business_id, auth.uid(),
      'user.role_changed', 'profile', new.id::text,
      jsonb_build_object('role', old.role),
      jsonb_build_object('role', new.role)
    );
  end if;
  return new;
end;
$$;

create trigger audit_profile_role
  after update on profiles
  for each row execute function audit_profile_role_change();
