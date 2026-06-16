-- Add missing columns to businesses table that may not exist if the table
-- was created outside the migration system or with an older schema.
alter table public.businesses
  add column if not exists employee_count text,
  add column if not exists location       text,
  add column if not exists website_url    text,
  add column if not exists logo_url       text,
  add column if not exists phone          text,
  add column if not exists address        text,
  add column if not exists support_email  text,
  add column if not exists email_greeting text,
  add column if not exists email_signature text,
  add column if not exists email_footer_note text,
  add column if not exists tracking_id_prefix text,
  add column if not exists notify_on_status_change boolean not null default true,
  add column if not exists notification_email boolean not null default true,
  add column if not exists notification_sms boolean not null default false,
  add column if not exists notification_whatsapp boolean not null default false,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_step int not null default 1,
  add column if not exists plan text not null default 'free';
