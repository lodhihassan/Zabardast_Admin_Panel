-- ----------------------------------------------------------------
-- FUNCTION: Upsert Student FCM Push Token
-- Registered by Flutter mobile app upon login or token refresh
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_upsert_push_token(
    p_user_id     UUID,
    p_fcm_token   TEXT,
    p_device_type VARCHAR(20) DEFAULT 'android'
)
RETURNS JSON AS $$
BEGIN
    INSERT INTO public.user_push_tokens_t (
        user_id,
        fcm_token,
        device_type,
        is_active,
        updated_date
    ) VALUES (
        p_user_id,
        p_fcm_token,
        COALESCE(p_device_type, 'android'),
        TRUE,
        NOW()
    )
    ON CONFLICT (user_id, fcm_token) DO UPDATE SET
        device_type = EXCLUDED.device_type,
        is_active = TRUE,
        updated_date = NOW();

    RETURN json_build_object(
        'success', TRUE,
        'message', 'FCM push token registered successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
