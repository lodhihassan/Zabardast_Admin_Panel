-- ==============================================================================
-- Migration: 36_secure_rls_policies.sql
-- Description: Replaces the insecure 'public_crud_policy' (open to all) with
--              production-grade Row Level Security (RLS) policies.
-- 
-- Fixes Auditor (HEARD LLP) Critical Security Issue:
--   "34 of 35 tables use a policy allowing any user of the app's public key
--    to read, change or delete every row."
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Helper Functions for Role Checking
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT TRUE FROM public.admin_profiles_t WHERE user_id = auth.uid() AND is_active = true LIMIT 1),
    (SELECT TRUE FROM public.users_t WHERE user_id = auth.uid() AND role_id = 1 AND is_active = true LIMIT 1),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT TRUE FROM public.vendor_users_t WHERE user_id = auth.uid() AND is_active = true LIMIT 1),
    (SELECT TRUE FROM public.users_t WHERE user_id = auth.uid() AND role_id IN (2, 4) AND is_active = true LIMIT 1),
    FALSE
  );
$$;

-- ------------------------------------------------------------------------------
-- STEP 2: Drop the Insecure 'public_crud_policy' from all 34 public tables
-- ------------------------------------------------------------------------------

DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP 
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS public_crud_policy ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'DROP POLICY IF EXISTS allow_authenticated_all ON public.' || quote_ident(r.tablename) || ';';
        EXECUTE 'DROP POLICY IF EXISTS allow_anon_read ON public.' || quote_ident(r.tablename) || ';';
    END LOOP; 
END $$;


-- ------------------------------------------------------------------------------
-- STEP 3: CATEGORY A - Public Catalog Tables (Read-only for public, writes restricted)
-- ------------------------------------------------------------------------------

-- 1. deals_t
DROP POLICY IF EXISTS deals_select_policy ON public.deals_t;
DROP POLICY IF EXISTS deals_modify_policy ON public.deals_t;
CREATE POLICY deals_select_policy ON public.deals_t 
    FOR SELECT TO public USING (true);
CREATE POLICY deals_modify_policy ON public.deals_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 2. categories_t
DROP POLICY IF EXISTS categories_select_policy ON public.categories_t;
DROP POLICY IF EXISTS categories_modify_policy ON public.categories_t;
CREATE POLICY categories_select_policy ON public.categories_t 
    FOR SELECT TO public USING (true);
CREATE POLICY categories_modify_policy ON public.categories_t 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. institutes_t
DROP POLICY IF EXISTS institutes_select_policy ON public.institutes_t;
DROP POLICY IF EXISTS institutes_modify_policy ON public.institutes_t;
CREATE POLICY institutes_select_policy ON public.institutes_t 
    FOR SELECT TO public USING (true);
CREATE POLICY institutes_modify_policy ON public.institutes_t 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. institute_campuses_t
DROP POLICY IF EXISTS institute_campuses_select_policy ON public.institute_campuses_t;
DROP POLICY IF EXISTS institute_campuses_modify_policy ON public.institute_campuses_t;
CREATE POLICY institute_campuses_select_policy ON public.institute_campuses_t 
    FOR SELECT TO public USING (true);
CREATE POLICY institute_campuses_modify_policy ON public.institute_campuses_t 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. branches_t
DROP POLICY IF EXISTS branches_select_policy ON public.branches_t;
DROP POLICY IF EXISTS branches_modify_policy ON public.branches_t;
CREATE POLICY branches_select_policy ON public.branches_t 
    FOR SELECT TO public USING (true);
CREATE POLICY branches_modify_policy ON public.branches_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 6. vendors_t
DROP POLICY IF EXISTS vendors_select_policy ON public.vendors_t;
DROP POLICY IF EXISTS vendors_modify_policy ON public.vendors_t;
CREATE POLICY vendors_select_policy ON public.vendors_t 
    FOR SELECT TO public USING (true);
CREATE POLICY vendors_modify_policy ON public.vendors_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 7. products_t
DROP POLICY IF EXISTS products_select_policy ON public.products_t;
DROP POLICY IF EXISTS products_modify_policy ON public.products_t;
CREATE POLICY products_select_policy ON public.products_t 
    FOR SELECT TO public USING (true);
CREATE POLICY products_modify_policy ON public.products_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 8. sub_products_t
DROP POLICY IF EXISTS sub_products_select_policy ON public.sub_products_t;
DROP POLICY IF EXISTS sub_products_modify_policy ON public.sub_products_t;
CREATE POLICY sub_products_select_policy ON public.sub_products_t 
    FOR SELECT TO public USING (true);
CREATE POLICY sub_products_modify_policy ON public.sub_products_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 9. deal_fine_print_t
DROP POLICY IF EXISTS deal_fine_print_select_policy ON public.deal_fine_print_t;
DROP POLICY IF EXISTS deal_fine_print_modify_policy ON public.deal_fine_print_t;
CREATE POLICY deal_fine_print_select_policy ON public.deal_fine_print_t 
    FOR SELECT TO public USING (true);
CREATE POLICY deal_fine_print_modify_policy ON public.deal_fine_print_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 10. deal_scope_t
DROP POLICY IF EXISTS deal_scope_select_policy ON public.deal_scope_t;
DROP POLICY IF EXISTS deal_scope_modify_policy ON public.deal_scope_t;
CREATE POLICY deal_scope_select_policy ON public.deal_scope_t 
    FOR SELECT TO public USING (true);
CREATE POLICY deal_scope_modify_policy ON public.deal_scope_t 
    FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor()) WITH CHECK (public.is_admin() OR public.is_vendor());

-- 11. general_parameter_hd
DROP POLICY IF EXISTS general_parameter_hd_select ON public.general_parameter_hd;
DROP POLICY IF EXISTS general_parameter_hd_modify ON public.general_parameter_hd;
CREATE POLICY general_parameter_hd_select ON public.general_parameter_hd 
    FOR SELECT TO public USING (true);
CREATE POLICY general_parameter_hd_modify ON public.general_parameter_hd 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 12. general_parameter_dt
DROP POLICY IF EXISTS general_parameter_dt_select ON public.general_parameter_dt;
DROP POLICY IF EXISTS general_parameter_dt_modify ON public.general_parameter_dt;
CREATE POLICY general_parameter_dt_select ON public.general_parameter_dt 
    FOR SELECT TO public USING (true);
CREATE POLICY general_parameter_dt_modify ON public.general_parameter_dt 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 13. referral_reward_tiers_t
DROP POLICY IF EXISTS referral_reward_tiers_select ON public.referral_reward_tiers_t;
DROP POLICY IF EXISTS referral_reward_tiers_modify ON public.referral_reward_tiers_t;
CREATE POLICY referral_reward_tiers_select ON public.referral_reward_tiers_t 
    FOR SELECT TO public USING (true);
CREATE POLICY referral_reward_tiers_modify ON public.referral_reward_tiers_t 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 14. roles_t
DROP POLICY IF EXISTS roles_select_policy ON public.roles_t;
DROP POLICY IF EXISTS roles_modify_policy ON public.roles_t;
CREATE POLICY roles_select_policy ON public.roles_t 
    FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_modify_policy ON public.roles_t 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 15. uploaded_files_t
DROP POLICY IF EXISTS uploaded_files_select ON public.uploaded_files_t;
DROP POLICY IF EXISTS uploaded_files_insert ON public.uploaded_files_t;
DROP POLICY IF EXISTS uploaded_files_modify ON public.uploaded_files_t;
CREATE POLICY uploaded_files_select ON public.uploaded_files_t 
    FOR SELECT TO public USING (true);
CREATE POLICY uploaded_files_insert ON public.uploaded_files_t 
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY uploaded_files_modify ON public.uploaded_files_t 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- STEP 4: CATEGORY B - Student Private PII Tables (User Isolation + Admin review)
-- ------------------------------------------------------------------------------

-- 16. student_profiles_t
DROP POLICY IF EXISTS student_profiles_select ON public.student_profiles_t;
DROP POLICY IF EXISTS student_profiles_insert ON public.student_profiles_t;
DROP POLICY IF EXISTS student_profiles_update ON public.student_profiles_t;
DROP POLICY IF EXISTS student_profiles_delete ON public.student_profiles_t;

CREATE POLICY student_profiles_select ON public.student_profiles_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin() OR public.is_vendor());

CREATE POLICY student_profiles_insert ON public.student_profiles_t 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY student_profiles_update ON public.student_profiles_t 
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY student_profiles_delete ON public.student_profiles_t 
    FOR DELETE TO authenticated 
    USING (public.is_admin());

-- 17. student_verifications_t
DROP POLICY IF EXISTS student_verifications_select ON public.student_verifications_t;
DROP POLICY IF EXISTS student_verifications_insert ON public.student_verifications_t;
DROP POLICY IF EXISTS student_verifications_update ON public.student_verifications_t;
DROP POLICY IF EXISTS student_verifications_delete ON public.student_verifications_t;

CREATE POLICY student_verifications_select ON public.student_verifications_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY student_verifications_insert ON public.student_verifications_t 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY student_verifications_update ON public.student_verifications_t 
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY student_verifications_delete ON public.student_verifications_t 
    FOR DELETE TO authenticated 
    USING (public.is_admin());

-- 18. users_t
DROP POLICY IF EXISTS users_select ON public.users_t;
DROP POLICY IF EXISTS users_insert ON public.users_t;
DROP POLICY IF EXISTS users_update ON public.users_t;
DROP POLICY IF EXISTS users_delete ON public.users_t;

CREATE POLICY users_select ON public.users_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin() OR public.is_vendor());

CREATE POLICY users_insert ON public.users_t 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY users_update ON public.users_t 
    FOR UPDATE TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY users_delete ON public.users_t 
    FOR DELETE TO authenticated 
    USING (public.is_admin());

-- 19. user_notifications_t
DROP POLICY IF EXISTS user_notifications_select ON public.user_notifications_t;
DROP POLICY IF EXISTS user_notifications_modify ON public.user_notifications_t;

CREATE POLICY user_notifications_select ON public.user_notifications_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY user_notifications_modify ON public.user_notifications_t 
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 20. user_notification_settings_t
DROP POLICY IF EXISTS user_notif_settings_select ON public.user_notification_settings_t;
DROP POLICY IF EXISTS user_notif_settings_modify ON public.user_notification_settings_t;

CREATE POLICY user_notif_settings_select ON public.user_notification_settings_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY user_notif_settings_modify ON public.user_notification_settings_t 
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 21. user_push_tokens_t
DROP POLICY IF EXISTS user_push_tokens_select ON public.user_push_tokens_t;
DROP POLICY IF EXISTS user_push_tokens_modify ON public.user_push_tokens_t;

CREATE POLICY user_push_tokens_select ON public.user_push_tokens_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY user_push_tokens_modify ON public.user_push_tokens_t 
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 22. student_referral_rewards_t
DROP POLICY IF EXISTS student_referral_rewards_select ON public.student_referral_rewards_t;
DROP POLICY IF EXISTS student_referral_rewards_modify ON public.student_referral_rewards_t;

CREATE POLICY student_referral_rewards_select ON public.student_referral_rewards_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY student_referral_rewards_modify ON public.student_referral_rewards_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 23. global_notifications_t
DROP POLICY IF EXISTS global_notifications_select ON public.global_notifications_t;
DROP POLICY IF EXISTS global_notifications_modify ON public.global_notifications_t;

CREATE POLICY global_notifications_select ON public.global_notifications_t 
    FOR SELECT TO authenticated 
    USING (true);

CREATE POLICY global_notifications_modify ON public.global_notifications_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 24. user_read_global_notifications_t
DROP POLICY IF EXISTS user_read_global_notif_select ON public.user_read_global_notifications_t;
DROP POLICY IF EXISTS user_read_global_notif_modify ON public.user_read_global_notifications_t;

CREATE POLICY user_read_global_notif_select ON public.user_read_global_notifications_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY user_read_global_notif_modify ON public.user_read_global_notifications_t 
    FOR ALL TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- ------------------------------------------------------------------------------
-- STEP 5: CATEGORY C - Redemptions & Transactions
-- ------------------------------------------------------------------------------

-- 25. deal_redemptions_t
DROP POLICY IF EXISTS deal_redemptions_select ON public.deal_redemptions_t;
DROP POLICY IF EXISTS deal_redemptions_insert ON public.deal_redemptions_t;
DROP POLICY IF EXISTS deal_redemptions_update ON public.deal_redemptions_t;
DROP POLICY IF EXISTS deal_redemptions_delete ON public.deal_redemptions_t;

CREATE POLICY deal_redemptions_select ON public.deal_redemptions_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin() OR public.is_vendor());

CREATE POLICY deal_redemptions_insert ON public.deal_redemptions_t 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY deal_redemptions_update ON public.deal_redemptions_t 
    FOR UPDATE TO authenticated 
    USING (public.is_admin() OR public.is_vendor())
    WITH CHECK (public.is_admin() OR public.is_vendor());

CREATE POLICY deal_redemptions_delete ON public.deal_redemptions_t 
    FOR DELETE TO authenticated 
    USING (public.is_admin());

-- 26. redemption_logs_history_t
DROP POLICY IF EXISTS redemption_logs_history_select ON public.redemption_logs_history_t;
DROP POLICY IF EXISTS redemption_logs_history_modify ON public.redemption_logs_history_t;

CREATE POLICY redemption_logs_history_select ON public.redemption_logs_history_t 
    FOR SELECT TO authenticated 
    USING (public.is_admin() OR public.is_vendor() OR auth.uid() = user_id);

CREATE POLICY redemption_logs_history_modify ON public.redemption_logs_history_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- STEP 6: CATEGORY D - Admin, Vendor Profiles & System Logs
-- ------------------------------------------------------------------------------

-- 27. admin_profiles_t
DROP POLICY IF EXISTS admin_profiles_select ON public.admin_profiles_t;
DROP POLICY IF EXISTS admin_profiles_modify ON public.admin_profiles_t;

CREATE POLICY admin_profiles_select ON public.admin_profiles_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY admin_profiles_modify ON public.admin_profiles_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 28. vendor_users_t
DROP POLICY IF EXISTS vendor_users_select ON public.vendor_users_t;
DROP POLICY IF EXISTS vendor_users_modify ON public.vendor_users_t;

CREATE POLICY vendor_users_select ON public.vendor_users_t 
    FOR SELECT TO authenticated 
    USING (auth.uid() = user_id OR public.is_admin() OR public.is_vendor());

CREATE POLICY vendor_users_modify ON public.vendor_users_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 29. push_notification_logs_t
DROP POLICY IF EXISTS push_notif_logs_policy ON public.push_notification_logs_t;
CREATE POLICY push_notif_logs_policy ON public.push_notification_logs_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 30. shopify_shops_t
DROP POLICY IF EXISTS shopify_shops_policy ON public.shopify_shops_t;
CREATE POLICY shopify_shops_policy ON public.shopify_shops_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 31. shopify_deal_settings_t
DROP POLICY IF EXISTS shopify_deal_settings_policy ON public.shopify_deal_settings_t;
CREATE POLICY shopify_deal_settings_policy ON public.shopify_deal_settings_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 32. shopify_vouchers_t
DROP POLICY IF EXISTS shopify_vouchers_policy ON public.shopify_vouchers_t;
CREATE POLICY shopify_vouchers_policy ON public.shopify_vouchers_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 33. shopify_voucher_uses_t
DROP POLICY IF EXISTS shopify_voucher_uses_policy ON public.shopify_voucher_uses_t;
CREATE POLICY shopify_voucher_uses_policy ON public.shopify_voucher_uses_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 34. shopify_webhook_log_t
DROP POLICY IF EXISTS shopify_webhook_log_policy ON public.shopify_webhook_log_t;
CREATE POLICY shopify_webhook_log_policy ON public.shopify_webhook_log_t 
    FOR ALL TO authenticated 
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==============================================================================
-- End of Migration 36_secure_rls_policies.sql
-- ==============================================================================

