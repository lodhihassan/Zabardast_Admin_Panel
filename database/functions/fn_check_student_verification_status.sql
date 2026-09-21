CREATE OR REPLACE FUNCTION public.check_student_verification_status(
    p_user_id UUID
) 
RETURNS JSON AS $$
DECLARE
    v_is_email_verified BOOLEAN := FALSE;
    v_student_email VARCHAR(255);
    v_is_verified BOOLEAN := FALSE;
    v_is_uploaded BOOLEAN := FALSE;
    v_doc_status VARCHAR(20) := 'NOT_SUBMITTED';
BEGIN
    -- 1. Check if student email is confirmed in auth.users
    SELECT email, (email_confirmed_at IS NOT NULL)
    INTO v_student_email, v_is_email_verified
    FROM auth.users
    WHERE id = p_user_id;

    IF v_is_email_verified IS NULL THEN
        v_is_email_verified := FALSE;
    END IF;

    -- 2. Check if student is verified in profile
    SELECT COALESCE(is_verified, FALSE) INTO v_is_verified
    FROM public.student_profiles_t
    WHERE user_id = p_user_id;

    -- 3. Check if student has uploaded documents
    SELECT TRUE, status 
    INTO v_is_uploaded, v_doc_status
    FROM public.student_verifications_t
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_is_uploaded IS NULL THEN
        v_is_uploaded := FALSE;
    END IF;
    
    IF v_is_verified = TRUE THEN
        v_is_uploaded := TRUE;
    END IF;

    -- 4. Return exact flags needed for Frontend UI routing
    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'email', v_student_email,
        'is_email_verified', v_is_email_verified,
        'is_uploaded', v_is_uploaded,
        'is_verified', v_is_verified,
        'doc_status', v_doc_status,
        'message', CASE 
                       WHEN v_is_email_verified = FALSE THEN 'Show Email Verification Screen'
                       WHEN v_is_verified = TRUE THEN 'Show Deals List (Redeem Picker)'
                       WHEN v_is_uploaded = TRUE AND v_is_verified = FALSE THEN 'Show Under Review Screen'
                       ELSE 'Show Verify to Unlock Screen'
                   END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

