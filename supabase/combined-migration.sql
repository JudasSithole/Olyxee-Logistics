-- ============================================================
-- Courier Loop â€” Initial Schema Migration
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

-- â”€â”€â”€ Extensions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- pgcrypto is pre-enabled on Supabase â€” gen_random_bytes() is always available
create extension if not exists "pgcrypto";

-- â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€ BUSINESSES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Users can only read/update their own business
create policy "businesses: read own"
  on businesses for select
  using (id = get_my_business_id());

create policy "businesses: update own"
  on businesses for update
  using (id = get_my_business_id());

-- â”€â”€â”€ PROFILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ TEAM INVITES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ CUSTOMERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "customers: own business"
  on customers for all
  using (business_id = get_my_business_id());

-- â”€â”€â”€ WORKFLOW TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "workflow_templates: own business"
  on workflow_templates for all
  using (business_id = get_my_business_id());

-- â”€â”€â”€ WORKFLOW STEPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "workflow_steps: via template"
  on workflow_steps for all
  using (
    template_id in (
      select id from workflow_templates where business_id = get_my_business_id()
    )
  );

-- â”€â”€â”€ BUSINESS WORKFLOWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "business_workflows: own business"
  on business_workflows for all
  using (business_id = get_my_business_id());

-- â”€â”€â”€ ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "orders: own business"
  on orders for all
  using (business_id = get_my_business_id());

-- Public tracking â€” no auth needed, read-only by tracking_id
create policy "orders: public tracking read"
  on orders for select
  using (true);
-- NOTE: The public tracking endpoint filters by tracking_id and only exposes
-- non-sensitive fields via the Edge Function â€” this is intentional.

-- â”€â”€â”€ TRACKING EVENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ NOTIFICATION TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "notification_templates: own business"
  on notification_templates for all
  using (business_id = get_my_business_id());

-- â”€â”€â”€ NOTIFICATION LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "notification_logs: own business"
  on notification_logs for all
  using (business_id = get_my_business_id());

-- â”€â”€â”€ REMINDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "reminders: own business"
  on reminders for all
  using (business_id = get_my_business_id());

-- â”€â”€â”€ AUDIT LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create policy "audit_logs: own business read"
  on audit_logs for select
  using (business_id = get_my_business_id());

-- Only the system (service_role) can insert audit logs
create policy "audit_logs: service insert only"
  on audit_logs for insert
  with check (false);
-- Override: Edge Functions use service_role key and bypass RLS
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
-- ============================================================
-- Business + User Signup Flow
-- 20260616000003_signup_flow.sql
--
-- When a new user signs up:
--   1. A business record is created (if businessName passed in metadata)
--   2. The profile is linked to that business
--   3. The user gets the 'owner' role
-- ============================================================

-- Called by the on_auth_user_created trigger in migration 0001.
-- Extend handle_new_user to also create a business if metadata present.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
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
    -- Build a unique slug from the business name
    v_slug_base := lower(regexp_replace(v_business_name, '[^a-z0-9]+', '-', 'gi'));
    v_slug_base := trim(both '-' from v_slug_base);
    v_slug      := v_slug_base;

    loop
      if not exists (select 1 from public.businesses where slug = v_slug) then
        exit;
      end if;
      v_suffix := v_suffix + 1;
      v_slug   := v_slug_base || '-' || v_suffix;
    end loop;

    -- Create the business
    insert into public.businesses (name, slug, support_email)
    values (
      v_business_name,
      v_slug,
      coalesce(new.email, '')
    )
    returning id into v_business_id;
  end if;

  -- Upsert the profile (trigger from migration 0001 may have already inserted it)
  insert into public.profiles (id, email, full_name, business_id, role)
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

-- Re-attach the trigger (drop and recreate cleanly)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
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

-- â”€â”€â”€ Trigger: orders status change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€â”€ Trigger: customers created/deleted â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€â”€ Trigger: team member role change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- ============================================================
-- System Workflow Presets (Seed Data)
-- 20260616000005_workflow_presets.sql
-- ============================================================

-- â”€â”€â”€ Add missing columns to businesses (table existed from old schema) â”€â”€â”€â”€â”€â”€â”€
alter table businesses add column if not exists business_type        text        not null default 'Logistics Company';
alter table businesses add column if not exists phone                text;
alter table businesses add column if not exists email                text;
alter table businesses add column if not exists address              text;
alter table businesses add column if not exists logo_url             text;
alter table businesses add column if not exists notify_on_status_change boolean not null default true;
alter table businesses add column if not exists notification_email   boolean     not null default true;
alter table businesses add column if not exists notification_sms     boolean     not null default false;
alter table businesses add column if not exists notification_whatsapp boolean    not null default false;
alter table businesses add column if not exists onboarding_step      int         not null default 1;
alter table businesses add column if not exists plan                 text        not null default 'free';
alter table businesses add column if not exists updated_at           timestamptz not null default now();

-- Drop old columns that no longer exist in new schema (safe â€” only if they exist)
alter table businesses drop column if exists industry;
alter table businesses drop column if exists employee_count;
alter table businesses drop column if exists allowed_origins;

-- Fix NOT NULL constraints from old schema that are now nullable
alter table businesses alter column website_url drop not null;
alter table businesses alter column location    drop not null;
alter table businesses alter column email_greeting   drop not null;
alter table businesses alter column email_signature  drop not null;
alter table businesses alter column email_footer_note drop not null;
alter table businesses alter column tracking_id_prefix drop not null;

-- Create a system business to own the presets
insert into businesses (id, name, slug, business_type, support_email)
values ('__system__', 'System Presets', '__system__', 'Custom Business', 'system@orderloop.app')
on conflict (id) do nothing;

-- â”€â”€â”€ Logistics Company â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-logistics', '__system__', 'Standard Delivery', 'Default logistics & courier workflow', 'Logistics Company', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Received',        'Order received and logged',                 1,  '#6366f1', false, true),
  ('Processing',      'Package being prepared for dispatch',       2,  '#8b5cf6', false, false),
  ('In Transit',      'Package in the delivery network',          3,  '#3b82f6', false, true),
  ('Out for Delivery','Driver en route to recipient',             4,  '#f97316', false, true),
  ('Delivered',       'Successfully delivered to recipient',      5,  '#22c55e', true,  true),
  ('Failed Delivery', 'Delivery attempt unsuccessful',            6,  '#ef4444', true,  true),
  ('Returned',        'Package returned to sender',               7,  '#6b7280', true,  false),
  ('Cancelled',       'Order cancelled',                          8,  '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Restaurant / Food Delivery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-restaurant', '__system__', 'Food Order', 'Restaurant and food delivery workflow', 'Restaurant', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Order Placed',    'Customer order received',                   1, '#6366f1', false, true),
  ('Confirmed',       'Restaurant confirmed the order',            2, '#8b5cf6', false, true),
  ('Preparing',       'Food is being prepared',                    3, '#f59e0b', false, false),
  ('Ready for Pickup','Ready for driver pickup or customer',       4, '#f97316', false, true),
  ('On the Way',      'Driver en route to customer',              5, '#3b82f6', false, true),
  ('Delivered',       'Order delivered successfully',              6, '#22c55e', true,  true),
  ('Cancelled',       'Order cancelled',                           7, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Retail Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-retail', '__system__', 'Retail Order', 'Retail e-commerce or in-store order fulfilment', 'Retail Store', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Order Placed',    'Purchase confirmed',                        1, '#6366f1', false, true),
  ('Payment Verified','Payment cleared',                           2, '#8b5cf6', false, false),
  ('Picking',         'Items being picked from stock',            3, '#f59e0b', false, false),
  ('Packed',          'Order packed and labelled',                 4, '#f97316', false, false),
  ('Dispatched',      'Handed to courier',                         5, '#3b82f6', false, true),
  ('Delivered',       'Delivered to customer',                     6, '#22c55e', true,  true),
  ('Returned',        'Item returned',                             7, '#6b7280', true,  false),
  ('Cancelled',       'Order cancelled',                           8, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Pharmacy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-pharmacy', '__system__', 'Prescription Order', 'Pharmacy prescription fulfilment workflow', 'Pharmacy', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Prescription Received', 'Prescription received for verification', 1, '#6366f1', false, true),
  ('Verification',          'Pharmacist reviewing prescription',      2, '#8b5cf6', false, false),
  ('Dispensing',            'Medication being dispensed',             3, '#f59e0b', false, false),
  ('Ready for Collection',  'Ready for pickup or delivery',           4, '#f97316', false, true),
  ('Out for Delivery',      'Delivery in progress',                   5, '#3b82f6', false, true),
  ('Collected/Delivered',   'Patient has received medication',        6, '#22c55e', true,  true),
  ('Cancelled',             'Order cancelled',                        7, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Dry Cleaner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-dry-cleaner', '__system__', 'Dry Cleaning Order', 'Garment cleaning and collection workflow', 'Dry Cleaner', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Items Received',   'Garments dropped off or collected',       1, '#6366f1', false, true),
  ('Inspecting',       'Inspecting items for damage/stains',      2, '#8b5cf6', false, false),
  ('Cleaning',         'Garments in cleaning process',            3, '#3b82f6', false, false),
  ('Pressing',         'Ironing and finishing',                   4, '#f59e0b', false, false),
  ('Ready',            'Ready for collection or delivery',        5, '#f97316', false, true),
  ('Out for Delivery', 'Being delivered to customer',             6, '#3b82f6', false, true),
  ('Collected',        'Customer has collected garments',         7, '#22c55e', true,  true),
  ('Cancelled',        'Order cancelled',                         8, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Repair Shop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-repair-shop', '__system__', 'Repair Job', 'Device and appliance repair workflow', 'Repair Shop', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Logged In',        'Device received and logged',              1, '#6366f1', false, true),
  ('Diagnosing',       'Technician diagnosing the issue',         2, '#8b5cf6', false, false),
  ('Awaiting Parts',   'Waiting for spare parts',                 3, '#f59e0b', false, false),
  ('Repairing',        'Repair in progress',                      4, '#3b82f6', false, false),
  ('Quality Check',    'Final quality inspection',                5, '#8b5cf6', false, false),
  ('Ready',            'Ready for collection or delivery',        6, '#f97316', false, true),
  ('Collected',        'Customer has collected the device',       7, '#22c55e', true,  true),
  ('Unrepairable',     'Device could not be repaired',            8, '#ef4444', true,  true),
  ('Cancelled',        'Job cancelled',                           9, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Printing Shop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-printing-shop', '__system__', 'Print Job', 'Print and design order workflow', 'Printing Shop', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Job Received',     'Print job submitted',                     1, '#6366f1', false, true),
  ('Design Review',    'Checking artwork / files for print',      2, '#8b5cf6', false, false),
  ('Awaiting Approval','Proof sent to customer',                  3, '#f59e0b', false, true),
  ('Printing',         'Job on the press',                        4, '#3b82f6', false, false),
  ('Finishing',        'Cutting, binding, laminating',            5, '#f59e0b', false, false),
  ('Ready',            'Job ready for collection or delivery',    6, '#f97316', false, true),
  ('Delivered',        'Job delivered to customer',               7, '#22c55e', true,  true),
  ('Cancelled',        'Job cancelled',                           8, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;

-- â”€â”€â”€ Custom Business (generic fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
with t as (
  insert into workflow_templates (id, business_id, name, description, business_type, is_system)
  values ('preset-custom', '__system__', 'Custom Workflow', 'Fully customisable workflow', 'Custom Business', true)
  on conflict (id) do nothing
  returning id
)
insert into workflow_steps (template_id, label, description, position, color, is_terminal, auto_notify)
select t.id, s.label, s.description, s.position, s.color, s.is_terminal, s.auto_notify
from t, (values
  ('Received',    'Job received',              1, '#6366f1', false, true),
  ('In Progress', 'Work in progress',          2, '#3b82f6', false, false),
  ('Ready',       'Ready for client',          3, '#f97316', false, true),
  ('Completed',   'Job completed',             4, '#22c55e', true,  true),
  ('Cancelled',   'Job cancelled',             5, '#9ca3af', true,  false)
) as s(label, description, position, color, is_terminal, auto_notify)
on conflict do nothing;
