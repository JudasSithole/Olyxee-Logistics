-- ============================================================================
-- Olyxee production hotfix: remove legacy Supabase triggers/FKs that break writes
-- ============================================================================
-- SYMPTOM: every write path 500s in prod (POST /api/customers,
-- POST /api/orders/:id/status, order create, customer edit) while every GET
-- works. Reads never fire triggers; writes do.
--
-- ROOT CAUSE (verified against prod information_schema): the id columns are
-- ALREADY text (the uuid conversion below is a no-op kept for safety). The
-- actual breakage is leftover Supabase triggers that fire only on writes and
-- reference things the migrated-off-Supabase app no longer has:
--   * audit_customers / audit_order_status -> call auth.uid()
--   * on_order_created -> increment_customer_orders() does
--     `UPDATE customers SET total_orders = ...`, but customers has no
--     total_orders column ("column total_orders does not exist")
--   * customers_updated_at -> set_updated_at() assigns NEW.updated_at, but
--     customers has no updated_at column ("record new has no field updated_at")
--
-- This script is idempotent and safe to re-run. Run it ONCE against the
-- PRODUCTION database (e.g. the Supabase SQL editor). Already applied to prod.
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

-- 4. Remove the obsolete on_order_created trigger. Its function
--    increment_customer_orders() does `UPDATE customers SET total_orders = ...`,
--    but the customers table has no `total_orders` column (the app never tracked
--    it), so every order INSERT failed with `column "total_orders" does not
--    exist`. The application does not maintain this counter, so the trigger is
--    dropped rather than adding a dead column.
DROP TRIGGER IF EXISTS on_order_created ON public.orders;

-- 5. Remove the obsolete customers_updated_at trigger. Its set_updated_at()
--    function assigns NEW.updated_at, but the customers table has no
--    `updated_at` column (the app's schema never defined one), so every customer
--    UPDATE failed with `record "new" has no field "updated_at"`. The table that
--    does have updated_at (orders) keeps its trigger.
DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;

COMMIT;
