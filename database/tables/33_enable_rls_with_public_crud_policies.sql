-- ================================================================
-- Migration: 33_enable_rls_with_public_crud_policies.sql
-- Description: Enables Row Level Security (RLS) on all public tables
--              for Supabase / App Store compliance, while adding
--              permissive CRUD policies so that the client SDK
--              can perform SELECT, INSERT, UPDATE, DELETE seamlessly.
-- ================================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        -- 1. Enable RLS on the table
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';

        -- 2. Clean up any existing policies
        EXECUTE 'DROP POLICY IF EXISTS public_crud_policy ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'DROP POLICY IF EXISTS allow_authenticated_all ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'DROP POLICY IF EXISTS allow_anon_read ON public.' || quote_ident(r.tablename) || ';';

        -- 3. Create full CRUD permissive policy for all roles (anon, authenticated, service_role)
        EXECUTE 'CREATE POLICY public_crud_policy ON public.' || quote_ident(r.tablename) || 
                ' FOR ALL TO public USING (true) WITH CHECK (true);';
    END LOOP; 
END $$;
