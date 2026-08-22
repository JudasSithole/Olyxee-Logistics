ALTER TABLE "tracking_events"
  ADD COLUMN IF NOT EXISTS "exception_type" text;
