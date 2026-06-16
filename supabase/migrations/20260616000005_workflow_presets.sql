-- ============================================================
-- System Workflow Presets (Seed Data)
-- 20260616000005_workflow_presets.sql
-- ============================================================

-- ─── Add missing columns to businesses (table existed from old schema) ───────
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

-- Drop old columns that no longer exist in new schema (safe — only if they exist)
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

-- ─── Logistics Company ───────────────────────────────────────────────────────
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

-- ─── Restaurant / Food Delivery ──────────────────────────────────────────────
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

-- ─── Retail Store ────────────────────────────────────────────────────────────
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

-- ─── Pharmacy ────────────────────────────────────────────────────────────────
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

-- ─── Dry Cleaner ─────────────────────────────────────────────────────────────
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

-- ─── Repair Shop ─────────────────────────────────────────────────────────────
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

-- ─── Printing Shop ───────────────────────────────────────────────────────────
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

-- ─── Custom Business (generic fallback) ──────────────────────────────────────
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
