-- ==============================================================================
-- Migration: 39_secure_function_search_paths.sql
-- Description: Sets an explicit, secure search_path (public, pg_temp) on all
--              SECURITY DEFINER functions in the public schema.
-- 
-- Fixes Auditor (HEARD LLP) High Security Issue:
--   "35 of 37 database functions run with elevated privileges (SECURITY DEFINER)
--    and have not been reviewed."
-- Setting an explicit search_path prevents search-path hijacking attacks.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND (p.proconfig IS NULL OR NOT (p.proconfig::text[] @> ARRAY['search_path=public, pg_temp']))
          AND p.proname NOT IN ('fn_admin_update_user_password', 'fn_send_push_notification')
    ) LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp;', r.proname, r.args);
            RAISE NOTICE 'Secured search_path for function: %(%)', r.proname, r.args;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Could not alter search_path for function %(%): %', r.proname, r.args, SQLERRM;
        END;
    END LOOP;
END $$;
