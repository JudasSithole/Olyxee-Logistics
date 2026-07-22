-- Additive, non-destructive migration for SMS notifications.
-- Safe to run repeatedly; does not touch existing data.

CREATE TABLE IF NOT EXISTS public.sms_notifications (
  id text NOT NULL PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.orders(id),
  customer_phone text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_notifications_order_id_idx ON public.sms_notifications (order_id);
