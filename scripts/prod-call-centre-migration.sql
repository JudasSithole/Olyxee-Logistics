-- Additive, non-destructive migration for the AI call centre feature.
-- Safe to run repeatedly; does not touch existing data.

-- businesses: AI call minutes counter
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ai_call_minutes_used integer NOT NULL DEFAULT 0;

-- call_usage: per-call metering ledger
CREATE TABLE IF NOT EXISTS public.call_usage (
  id text NOT NULL PRIMARY KEY,
  business_id text NOT NULL REFERENCES public.businesses(id),
  call_id text NOT NULL UNIQUE,
  minutes integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_usage_business_id_idx ON public.call_usage (business_id);
