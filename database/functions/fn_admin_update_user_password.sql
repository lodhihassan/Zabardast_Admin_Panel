-- ================================================================
-- FUNCTION: fn_admin_update_user_password
-- Purpose: Allows updating a user's password in auth.users by user_id
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_admin_update_user_password(
    p_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters long.');
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found in auth.');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_update_user_password(UUID, TEXT) TO anon, authenticated, service_role;
