-- ============================================================================
-- Olyxee production hotfix: convert legacy Supabase uuid id-columns to text
-- ============================================================================
-- WHY: The app was migrated off Supabase auth and now uses text ids
-- (generateId()), but the production database still defines these columns as
-- `uuid references auth.users(id)`. Inserting a text id into a uuid column
-- fails with `invalid input syntax for type uuid`, which is why every write
-- (POST /api/customers, POST /api/orders/:id/status, order create) returns 500
-- while reads (GET) succeed.
--
-- This script is idempotent and safe to re-run. Run it ONCE against the
-- PRODUCTION database (e.g. the Supabase SQL editor).
-- ============================================================================

BEGIN;

-- 1. Drop foreign keys to auth.users on the columns we need to convert.
--    Constraint names are auto-generated, so discover and drop them dynamically.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema   = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema    = 'public'
      AND (
        (tc.table_name = 'audit_logs'      AND kcu.column_name = 'user_id')    OR
        (tc.table_name = 'orders'          AND kcu.column_name = 'created_by') OR
        (tc.table_name = 'tracking_events' AND kcu.column_name = 'created_by')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- 2. Convert the id columns from uuid to text (existing uuid values are kept,
--    cast to their text form). No-ops if a column is already text.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='audit_logs'
               AND column_name='user_id' AND data_type='uuid') THEN
    ALTER TABLE public.audit_logs ALTER COLUMN user_id TYPE text USING user_id::text;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='orders'
               AND column_name='created_by' AND data_type='uuid') THEN
    ALTER TABLE public.orders ALTER COLUMN created_by TYPE text USING created_by::text;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='tracking_events'
               AND column_name='created_by' AND data_type='uuid') THEN
    ALTER TABLE public.tracking_events ALTER COLUMN created_by TYPE text USING created_by::text;
  END IF;
END $$;

-- 3. Remove the obsolete Supabase audit triggers. They call auth.uid() and
--    duplicate the audit rows the application now writes itself.
DROP TRIGGER IF EXISTS audit_customers   ON public.customers;
DROP TRIGGER IF EXISTS audit_order_status ON public.orders;

COMMIT;
