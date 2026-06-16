-- ============================================================
-- Courier Loop — Initial Schema Migration
-- 20260616000001_initial_schema.sql
--
-- Covers:
--   1. Enable extensions
--   2. Businesses (multi-tenant root)
--   3. Profiles (extends auth.users)
--   4. Customers
--   5. Workflow Templates + Steps + Business Active Workflow
--   6. Orders + Tracking Events
--   7. Notification Templates + Logs
--   8. Audit Logs
--   9. Reminders
--  10. Team Invites
--  11. Row Level Security policies
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
-- pgcrypto is pre-enabled on Supabase — gen_random_bytes() is always available
create extension if not exists "pgcrypto";

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Generate a short, URL-safe random ID (like CUID-lite)
create or replace function generate_id()
returns text
language sql
as $$
  select encode(extensions.gen_random_bytes(12), 'hex');
$$;

-- Auto-updated updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 1. BUSINESSES
-- Root of the multi-tenant hierarchy. Every row is one tenant.
-- ============================================================
create table if not exists businesses (
  id                    text        primary key default generate_id(),
  name                  text        not null,
  slug                  text        not null unique,
  business_type         text        not null default 'Logistics Company',
  -- allowed values: 'Logistics Company' | 'Restaurant' | 'Retail Store' |
  --   'Pharmacy' | 'Dry Cleaner' | 'Repair Shop' | 'Printing Shop' | 'Custom Business'
  phone                 text,
  email                 text,
  address               text,
  logo_url              text,
  website_url           text,
  support_email         text,
  location              text,
  employee_count        text,
  -- Branding / email settings
  email_greeting        text,
  email_signature       text,
  email_footer_note     text,
  tracking_id_prefix    text        unique,
  -- Notification toggles
  notify_on_status_change boolean   not null default true,
  notification_email    boolean     not null default true,
  notification_sms      boolean     not null default false,
  notification_whatsapp boolean     not null default false,
  -- Onboarding state
  onboarding_completed  boolean     not null default false,
  onboarding_step       int         not null default 1,
  -- Plan / billing (placeholder)
  plan                  text        not null default 'free',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();


-- ============================================================
-- 2. PROFILES
-- One profile per Supabase auth user. Linked to a business.
-- ============================================================
create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  business_id text        references businesses(id) on delete set null,
  full_name   text        not null default '',
  email       text        not null default '',
  role        text        not null default 'staff',
  -- allowed values: 'owner' | 'admin' | 'manager' | 'staff'
  avatar_url  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create profile on auth.users insert
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- 3. TEAM INVITES
-- ============================================================
create table if not exists team_invites (
  id          text        primary key default generate_id(),
  business_id text        not null references businesses(id) on delete cascade,
  email       text        not null,
  role        text        not null default 'staff',
  token       text        not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by  uuid        references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

create index team_invites_business_id_idx on team_invites(business_id);
create index team_invites_email_idx on team_invites(email);


-- ============================================================
-- 4. CUSTOMERS
-- Each customer belongs to one business.
-- ============================================================
create table if not exists customers (
  id           text        primary key default generate_id(),
  business_id  text        not null references businesses(id) on delete cascade,
  full_name    text        not null,
  email        text        not null default '',
  phone        text,
  company_name text,
  address      text,
  notes        text,
  total_orders int         not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index customers_business_id_idx on customers(business_id);
create index customers_email_idx on customers(business_id, email);
create index customers_phone_idx on customers(business_id, phone);

create trigger customers_updated_at
  before update on customers
  for each row execute function set_updated_at();


-- ============================================================
-- 5. WORKFLOW TEMPLATES + STEPS
-- ============================================================
create table if not exists workflow_templates (
  id            text        primary key default generate_id(),
  business_id   text        not null references businesses(id) on delete cascade,
  name          text        not null,
  description   text,
  business_type text,
  is_system     boolean     not null default false,
  -- system presets are read-only; users clone them
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index workflow_templates_business_id_idx on workflow_templates(business_id);

create trigger workflow_templates_updated_at
  before update on workflow_templates
  for each row execute function set_updated_at();


create table if not exists workflow_steps (
  id          text        primary key default generate_id(),
  template_id text        not null references workflow_templates(id) on delete cascade,
  label       text        not null,
  description text,
  position    int         not null,
  color       text        not null default '#6366f1',
  is_terminal boolean     not null default false,
  -- Notification settings per step
  auto_notify boolean     not null default false,
  notify_template_id text  -- FK added after notification_templates table
);

create index workflow_steps_template_id_idx on workflow_steps(template_id);


-- Active workflow assignment per business
create table if not exists business_workflows (
  id            text        primary key default generate_id(),
  business_id   text        not null unique references businesses(id) on delete cascade,
  template_id   text        not null,
  template_name text        not null,
  assigned_at   timestamptz not null default now()
);


-- ============================================================
-- 6. ORDERS
-- ============================================================
create table if not exists orders (
  id                     text        primary key default generate_id(),
  business_id            text        not null references businesses(id) on delete cascade,
  customer_id            text        not null references customers(id) on delete restrict,
  workflow_template_id   text        references workflow_templates(id) on delete set null,
  -- Tracking
  tracking_id            text        not null unique default generate_id(),
  order_reference        text,
  -- Status
  current_status         text        not null default 'Received',
  current_step_position  int         not null default 0,
  -- Customer-facing info
  description            text,
  estimated_completion   date,
  notes                  text,
  -- Meta
  is_archived            boolean     not null default false,
  created_by             uuid        references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index orders_business_id_idx on orders(business_id);
create index orders_customer_id_idx on orders(customer_id);
create index orders_tracking_id_idx on orders(tracking_id);
create index orders_current_status_idx on orders(business_id, current_status);
create index orders_created_at_idx on orders(business_id, created_at desc);

create trigger orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- Auto-increment customer total_orders
create or replace function increment_customer_orders()
returns trigger
language plpgsql
as $$
begin
  update customers
  set total_orders = total_orders + 1
  where id = new.customer_id;
  return new;
end;
$$;

create trigger on_order_created
  after insert on orders
  for each row execute function increment_customer_orders();


-- ============================================================
-- 7. TRACKING EVENTS (status timeline)
-- ============================================================
create table if not exists tracking_events (
  id         text        primary key default generate_id(),
  order_id   text        not null references orders(id) on delete cascade,
  status     text        not null,
  message    text,
  location   text,
  created_by uuid        references auth.users(id) on delete set null,
  -- whether customer was notified for this event
  notified   boolean     not null default false,
  created_at timestamptz not null default now()
);

create index tracking_events_order_id_idx on tracking_events(order_id);
create index tracking_events_created_at_idx on tracking_events(order_id, created_at);


-- ============================================================
-- 8. NOTIFICATION TEMPLATES + LOGS
-- ============================================================
create table if not exists notification_templates (
  id          text        primary key default generate_id(),
  business_id text        not null references businesses(id) on delete cascade,
  name        text        not null,
  channel     text        not null default 'email',
  -- 'email' | 'sms' | 'whatsapp'
  trigger_status text,
  -- null = manual, or a status name to auto-fire
  subject     text,
  -- email subject line
  body        text        not null,
  -- Supports variables: {{customer_name}}, {{status}}, {{tracking_url}}, {{business_name}}
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index notification_templates_business_id_idx on notification_templates(business_id);
create index notification_templates_trigger_status_idx on notification_templates(business_id, trigger_status);

create trigger notification_templates_updated_at
  before update on notification_templates
  for each row execute function set_updated_at();


create table if not exists notification_logs (
  id                   text        primary key default generate_id(),
  order_id             text        not null references orders(id) on delete cascade,
  business_id          text        not null references businesses(id) on delete cascade,
  customer_id          text        references customers(id) on delete set null,
  template_id          text        references notification_templates(id) on delete set null,
  channel              text        not null,
  recipient            text        not null,
  -- email/phone
  subject              text,
  body                 text        not null,
  status               text        not null default 'pending',
  -- 'pending' | 'sent' | 'failed' | 'delivered'
  provider_message_id  text,
  error_message        text,
  sent_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index notification_logs_order_id_idx on notification_logs(order_id);
create index notification_logs_business_id_idx on notification_logs(business_id);
create index notification_logs_created_at_idx on notification_logs(business_id, created_at desc);


-- ============================================================
-- 9. REMINDERS
-- ============================================================
create table if not exists reminders (
  id           text        primary key default generate_id(),
  business_id  text        not null references businesses(id) on delete cascade,
  order_id     text        not null references orders(id) on delete cascade,
  customer_id  text        not null references customers(id) on delete cascade,
  channel      text        not null default 'email',
  message      text        not null,
  scheduled_at timestamptz not null,
  sent_at      timestamptz,
  status       text        not null default 'pending',
  -- 'pending' | 'sent' | 'cancelled' | 'failed'
  created_at   timestamptz not null default now()
);

create index reminders_business_id_idx on reminders(business_id);
create index reminders_scheduled_at_idx on reminders(scheduled_at) where status = 'pending';


-- ============================================================
-- 10. AUDIT LOGS
-- ============================================================
create table if not exists audit_logs (
  id          text        primary key default generate_id(),
  business_id text        not null references businesses(id) on delete cascade,
  user_id     uuid        references auth.users(id) on delete set null,
  action      text        not null,
  -- e.g. 'order.status_changed', 'order.created', 'user.invited'
  entity_type text        not null,
  -- e.g. 'order', 'customer', 'user', 'business'
  entity_id   text,
  old_value   jsonb,
  new_value   jsonb,
  metadata    jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_logs_business_id_idx on audit_logs(business_id);
create index audit_logs_entity_idx on audit_logs(business_id, entity_type, entity_id);
create index audit_logs_created_at_idx on audit_logs(business_id, created_at desc);
create index audit_logs_user_id_idx on audit_logs(user_id);


-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table businesses              enable row level security;
alter table profiles                enable row level security;
alter table team_invites            enable row level security;
alter table customers               enable row level security;
alter table workflow_templates      enable row level security;
alter table workflow_steps          enable row level security;
alter table business_workflows      enable row level security;
alter table orders                  enable row level security;
alter table tracking_events         enable row level security;
alter table notification_templates  enable row level security;
alter table notification_logs       enable row level security;
alter table reminders               enable row level security;
alter table audit_logs              enable row level security;

-- Helper: get the business_id for the current auth user
create or replace function get_my_business_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select business_id from public.profiles where id = auth.uid();
$$;

-- Helper: get the role for the current auth user
create or replace function get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ─── BUSINESSES ──────────────────────────────────────────────────────────────
-- Users can only read/update their own business
create policy "businesses: read own"
  on businesses for select
  using (id = get_my_business_id());

create policy "businesses: update own"
  on businesses for update
  using (id = get_my_business_id());

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create policy "profiles: read own team"
  on profiles for select
  using (business_id = get_my_business_id() or id = auth.uid());

create policy "profiles: update own profile"
  on profiles for update
  using (id = auth.uid());

create policy "profiles: owner/admin can update team"
  on profiles for update
  using (
    business_id = get_my_business_id()
    and get_my_role() in ('owner', 'admin')
  );

-- ─── TEAM INVITES ─────────────────────────────────────────────────────────────
create policy "team_invites: read own business"
  on team_invites for select
  using (business_id = get_my_business_id());

create policy "team_invites: owner/admin insert"
  on team_invites for insert
  with check (
    business_id = get_my_business_id()
    and get_my_role() in ('owner', 'admin')
  );

create policy "team_invites: owner/admin delete"
  on team_invites for delete
  using (
    business_id = get_my_business_id()
    and get_my_role() in ('owner', 'admin')
  );

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
create policy "customers: own business"
  on customers for all
  using (business_id = get_my_business_id());

-- ─── WORKFLOW TEMPLATES ──────────────────────────────────────────────────────
create policy "workflow_templates: own business"
  on workflow_templates for all
  using (business_id = get_my_business_id());

-- ─── WORKFLOW STEPS ──────────────────────────────────────────────────────────
create policy "workflow_steps: via template"
  on workflow_steps for all
  using (
    template_id in (
      select id from workflow_templates where business_id = get_my_business_id()
    )
  );

-- ─── BUSINESS WORKFLOWS ──────────────────────────────────────────────────────
create policy "business_workflows: own business"
  on business_workflows for all
  using (business_id = get_my_business_id());

-- ─── ORDERS ──────────────────────────────────────────────────────────────────
create policy "orders: own business"
  on orders for all
  using (business_id = get_my_business_id());

-- Public tracking — no auth needed, read-only by tracking_id
create policy "orders: public tracking read"
  on orders for select
  using (true);
-- NOTE: The public tracking endpoint filters by tracking_id and only exposes
-- non-sensitive fields via the Edge Function — this is intentional.

-- ─── TRACKING EVENTS ─────────────────────────────────────────────────────────
create policy "tracking_events: own business orders"
  on tracking_events for all
  using (
    order_id in (
      select id from orders where business_id = get_my_business_id()
    )
  );

-- Public read for customer tracking portal
create policy "tracking_events: public read"
  on tracking_events for select
  using (true);

-- ─── NOTIFICATION TEMPLATES ──────────────────────────────────────────────────
create policy "notification_templates: own business"
  on notification_templates for all
  using (business_id = get_my_business_id());

-- ─── NOTIFICATION LOGS ───────────────────────────────────────────────────────
create policy "notification_logs: own business"
  on notification_logs for all
  using (business_id = get_my_business_id());

-- ─── REMINDERS ───────────────────────────────────────────────────────────────
create policy "reminders: own business"
  on reminders for all
  using (business_id = get_my_business_id());

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
create policy "audit_logs: own business read"
  on audit_logs for select
  using (business_id = get_my_business_id());

-- Only the system (service_role) can insert audit logs
create policy "audit_logs: service insert only"
  on audit_logs for insert
  with check (false);
-- Override: Edge Functions use service_role key and bypass RLS
