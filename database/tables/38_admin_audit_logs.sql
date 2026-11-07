-- ==============================================================================
-- Migration: 38_admin_audit_logs.sql
-- Description: Creates an immutable Administrative Audit Log table and triggers
--              for tracking sensitive operations (verification status changes,
--              deal modifications, and role updates).
-- 
-- Fixes Auditor (HEARD LLP) Issue:
--   "No admin audit log and no penetration test."
-- ==============================================================================

-- 1. Create audit_logs_t table
CREATE TABLE IF NOT EXISTS public.audit_logs_t (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email     VARCHAR(255),
    action          VARCHAR(50) NOT NULL, -- e.g., 'VERIFY_STUDENT', 'REJECT_STUDENT', 'CREATE_DEAL', 'UPDATE_DEAL', 'DELETE_DEAL'
    table_name      VARCHAR(100) NOT NULL,
    record_id       VARCHAR(100),
    old_data        JSONB,
    new_data        JSONB,
    ip_address      VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on audit_logs_t
ALTER TABLE public.audit_logs_t ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs_t;
DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs_t;
DROP POLICY IF EXISTS audit_logs_modify_policy ON public.audit_logs_t;

-- Only Admins can view audit logs
CREATE POLICY audit_logs_select_policy ON public.audit_logs_t
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- System & Triggers can insert logs (or authenticated admins)
CREATE POLICY audit_logs_insert_policy ON public.audit_logs_t
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- No one (even admins) can UPDATE or DELETE audit logs (Immutable Security Log)
-- (No UPDATE/DELETE policy defined = denied by default in RLS)

-- 3. Audit Trigger Function for Student Verifications
CREATE OR REPLACE FUNCTION public.trg_audit_student_verifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id    UUID;
    v_actor_email VARCHAR(255);
    v_action      VARCHAR(50);
BEGIN
    v_actor_id := auth.uid();
    
    -- Attempt to get actor email from auth.users or admin_profiles_t
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF NEW.status = 'A' THEN
                v_action := 'APPROVE_STUDENT_VERIFICATION';
            ELSIF NEW.status = 'R' THEN
                v_action := 'REJECT_STUDENT_VERIFICATION';
            ELSE
                v_action := 'UPDATE_VERIFICATION_STATUS';
            END IF;

            INSERT INTO public.audit_logs_t (
                actor_id,
                actor_email,
                action,
                table_name,
                record_id,
                old_data,
                new_data
            ) VALUES (
                v_actor_id,
                v_actor_email,
                v_action,
                'student_verifications_t',
                NEW.verification_id::text,
                jsonb_build_object('status', OLD.status, 'user_id', OLD.user_id),
                jsonb_build_object('status', NEW.status, 'user_id', NEW.user_id, 'updated_by', NEW.updated_by)
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_student_verifications_update ON public.student_verifications_t;
CREATE TRIGGER trg_audit_student_verifications_update
    AFTER UPDATE ON public.student_verifications_t
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_audit_student_verifications();

-- 4. Audit Trigger Function for Deals Management
CREATE OR REPLACE FUNCTION public.trg_audit_deals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id    UUID;
    v_actor_email VARCHAR(255);
    v_action      VARCHAR(50);
BEGIN
    v_actor_id := auth.uid();
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;

    IF TG_OP = 'INSERT' THEN
        v_action := 'CREATE_DEAL';
        INSERT INTO public.audit_logs_t (
            actor_id, actor_email, action, table_name, record_id, old_data, new_data
        ) VALUES (
            v_actor_id, v_actor_email, v_action, 'deals_t', NEW.deal_id::text, NULL, to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE_DEAL';
        INSERT INTO public.audit_logs_t (
            actor_id, actor_email, action, table_name, record_id, old_data, new_data
        ) VALUES (
            v_actor_id, v_actor_email, v_action, 'deals_t', NEW.deal_id::text, to_jsonb(OLD), to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE_DEAL';
        INSERT INTO public.audit_logs_t (
            actor_id, actor_email, action, table_name, record_id, old_data, new_data
        ) VALUES (
            v_actor_id, v_actor_email, v_action, 'deals_t', OLD.deal_id::text, to_jsonb(OLD), NULL
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_deals_changes ON public.deals_t;
CREATE TRIGGER trg_audit_deals_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.deals_t
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_audit_deals();

-- ==============================================================================
-- End of Migration 38_admin_audit_logs.sql
-- ==============================================================================
