-- Additive, non-destructive fix for prod Supabase schema drift.
-- The launch-prep release added new columns to the `businesses` table.
-- Drizzle's findFirst selects ALL schema columns, so any missing column
-- makes GET /api/business return 500. These ADD COLUMN IF NOT EXISTS
-- statements are safe to run repeatedly and do not touch existing data.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'beta',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'beta',
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS billing_customer_code text,
  ADD COLUMN IF NOT EXISTS billing_subscription_code text,
  ADD COLUMN IF NOT EXISTS billing_email_token text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamp,
  ADD COLUMN IF NOT EXISTS current_period_end timestamp,
  ADD COLUMN IF NOT EXISTS email_notifications_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_notifications_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_period_start timestamp,
  ADD COLUMN IF NOT EXISTS usage_period_end timestamp,
  ADD COLUMN IF NOT EXISTS business_logo_url text,
  ADD COLUMN IF NOT EXISTS email_sender_name text,
  ADD COLUMN IF NOT EXISTS primary_brand_colour text,
  ADD COLUMN IF NOT EXISTS remove_olyxee_branding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_centre_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retell_agent_id text,
  ADD COLUMN IF NOT EXISTS retell_phone_number text,
  ADD COLUMN IF NOT EXISTS retell_knowledge_base_id text,
  ADD COLUMN IF NOT EXISTS call_centre_forwarding_number text;
