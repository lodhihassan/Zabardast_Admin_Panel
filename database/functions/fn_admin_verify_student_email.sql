-- ================================================================
-- FUNCTION: fn_admin_verify_student_email
-- Allows Super Admin or backend to manually mark a student's email
-- as verified in auth.users
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_admin_verify_student_email(
    p_user_id UUID
)
RETURNS JSON AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE,
            'message', 'User ID is required.'
        );
    END IF;

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = p_user_id;

    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'message', 'Student email successfully marked as verified.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
