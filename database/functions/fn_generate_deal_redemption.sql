CREATE OR REPLACE FUNCTION public.generate_deal_redemption(
    p_user_id UUID, 
    p_deal_id INT  
)
RETURNS JSON AS $$
DECLARE
    v_is_email_verified BOOLEAN := FALSE;
    v_student_email VARCHAR(255);
    v_is_verified BOOLEAN;
    v_has_uploaded_docs BOOLEAN;
    v_limit_per_day INT;
    v_start_time TIME;
    v_end_time TIME;
    v_today_redemptions INT;
    v_qr_token VARCHAR(255);
    v_manual_code VARCHAR(100);
    v_existing_redemption RECORD;
    v_new_redemption RECORD;
    
    -- Pakistan Timezone Variable
    v_current_local_time TIME := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::time;
BEGIN
    -- 0. Null / Invalid Deal Check
    IF p_deal_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.deals_t WHERE deal_id = p_deal_id) THEN
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE,
            'message', 'Deal details not available. For referral rewards, please use RPC fn_redeem_referral_reward(user_id, tier_id).'
        );
    END IF;

    -- 1. Student Email Verification Check
    SELECT email, (email_confirmed_at IS NOT NULL)
    INTO v_student_email, v_is_email_verified
    FROM auth.users
    WHERE id = p_user_id;

    IF v_is_email_verified IS NOT TRUE THEN
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE,
            'code', 'EMAIL_VERIFICATION_REQUIRED',
            'is_email_verified', FALSE,
            'email', v_student_email,
            'message', 'Email verification required. Please verify your email address to redeem this deal.'
        );
    END IF;

    -- 2. Student Documents Verification Check
    SELECT is_verified INTO v_is_verified
    FROM public.student_profiles_t
    WHERE user_id = p_user_id;

    -- If not verified, check reason
    IF v_is_verified IS NOT TRUE THEN
        SELECT EXISTS (
            SELECT 1 FROM public.student_verifications_t WHERE user_id = p_user_id
        ) INTO v_has_uploaded_docs;

        IF v_has_uploaded_docs THEN
            RETURN JSON_BUILD_OBJECT(
                'success', FALSE,
                'code', 'DOCS_UNDER_REVIEW',
                'message', 'Your verification documents are currently under review. Please wait for admin approval.'
            );
        ELSE
            RETURN JSON_BUILD_OBJECT(
                'success', FALSE,
                'code', 'VERIFICATION_REQUIRED',
                'message', 'Verification required. Please upload your Student Card and CNIC to redeem this deal.'
            );
        END IF;
    END IF;

    -- 2. Fetch Deal Details
    SELECT redeem_limit_per_day, start_time, end_time 
    INTO v_limit_per_day, v_start_time, v_end_time
    FROM public.deals_t
    WHERE deal_id = p_deal_id;

    -- 3. Check Deal Timings (Using PKT Local Time)
    IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
        IF v_start_time <= v_end_time THEN
            IF v_current_local_time < v_start_time OR v_current_local_time > v_end_time THEN
                RETURN JSON_BUILD_OBJECT(
                    'success', FALSE,
                    'message', 'This deal is not available right now. Timings: ' || to_char(v_start_time, 'HH12:MI AM') || ' to ' || to_char(v_end_time, 'HH12:MI AM') || '.'
                );
            END IF;
        ELSE
            IF v_current_local_time < v_start_time AND v_current_local_time > v_end_time THEN
                RETURN JSON_BUILD_OBJECT(
                    'success', FALSE,
                    'message', 'This deal is not available right now. Timings: ' || to_char(v_start_time, 'HH12:MI AM') || ' to ' || to_char(v_end_time, 'HH12:MI AM') || '.'
                );
            END IF;
        END IF;
    END IF;

    -- 4. Check Daily Redemption Limit (PKT Timezone)
    IF v_limit_per_day IS NOT NULL AND v_limit_per_day > 0 THEN
        SELECT COUNT(*) INTO v_today_redemptions
        FROM public.redemption_logs_history_t
        WHERE user_id = p_user_id
          AND deal_id = p_deal_id
          AND scanned_at::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE;

        IF v_today_redemptions >= v_limit_per_day THEN
            RETURN JSON_BUILD_OBJECT(
                'success', FALSE,
                'message', 'You have reached your daily redemption limit (' || v_limit_per_day || ' per day) for this deal.'
            );
        END IF;
    END IF;

    -- 5. Mark older pending ('P') tokens as expired ('E') if 10 mins passed
    UPDATE public.deal_redemptions_t
    SET status = 'E'
    WHERE user_id = p_user_id 
      AND deal_id = p_deal_id 
      AND status = 'P'
      AND expires_at <= NOW();

    -- 6. Check for any currently active pending ('P') token
    SELECT redemption_id, qr_code_token, manual_code, expires_at INTO v_existing_redemption
    FROM public.deal_redemptions_t
    WHERE user_id = p_user_id 
      AND deal_id = p_deal_id 
      AND status = 'P'
      AND expires_at > NOW();

    IF FOUND THEN
        RETURN JSON_BUILD_OBJECT(
            'success', TRUE,
            'message', 'Active QR code already exists.',
            'is_new', FALSE,
            'redemption_id', v_existing_redemption.redemption_id,
            'qr_code_token', v_existing_redemption.qr_code_token,
            'manual_code', v_existing_redemption.manual_code,
            'expires_at', v_existing_redemption.expires_at
        );
    END IF;

    -- 7. Generate New Unique QR Token (ZBD-prefix) & Manual Code (ZB + 4 Digits)
    v_qr_token := 'ZBD-' || gen_random_uuid()::text;
    LOOP
        v_manual_code := 'ZB' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.deal_redemptions_t 
            WHERE manual_code = v_manual_code AND status = 'P' AND expires_at > NOW()
        );
    END LOOP;

    -- 8. Insert New Entry with Pending Status ('P')
    INSERT INTO public.deal_redemptions_t (
        user_id,
        deal_id,
        qr_code_token,
        manual_code,
        status,
        expires_at
    ) VALUES (
        p_user_id,
        p_deal_id,
        v_qr_token,
        v_manual_code,
        'P',
        NOW() + INTERVAL '10 minutes'
    )
    RETURNING redemption_id, qr_code_token, manual_code, expires_at INTO v_new_redemption;

    -- 9. Return New QR Details
    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'message', 'New QR Code generated successfully.',
        'is_new', TRUE,
        'redemption_id', v_new_redemption.redemption_id,
        'qr_code_token', v_new_redemption.qr_code_token,
        'manual_code', v_new_redemption.manual_code,
        'expires_at', v_new_redemption.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
