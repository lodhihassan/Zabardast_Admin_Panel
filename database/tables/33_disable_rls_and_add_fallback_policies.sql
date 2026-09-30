-- ================================================================
-- Migration: 33_disable_rls_and_add_fallback_policies.sql
-- Description: Disables Row Level Security (RLS) on all public tables
--              and adds permissive fallback policies for authenticated
--              and anon roles to ensure seamless client SDK data access.
-- ================================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        -- 1. Disable RLS
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';

        -- 2. Drop existing fallback policies if any
        EXECUTE 'DROP POLICY IF EXISTS allow_authenticated_all ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'DROP POLICY IF EXISTS allow_anon_read ON public.' || quote_ident(r.tablename) || ';';

        -- 3. Create permissive fallback policies in case RLS is accidentally re-enabled via Dashboard
        EXECUTE 'CREATE POLICY allow_authenticated_all ON public.' || quote_ident(r.tablename) || ' FOR ALL TO authenticated USING (true) WITH CHECK (true);';
        EXECUTE 'CREATE POLICY allow_anon_read ON public.' || quote_ident(r.tablename) || ' FOR SELECT TO anon USING (true);';
    END LOOP; 
END $$;
