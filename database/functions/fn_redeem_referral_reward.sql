CREATE OR REPLACE FUNCTION public.fn_redeem_referral_reward(
    p_user_id UUID,
    p_tier_id INT
)
RETURNS JSON AS $$
DECLARE
    v_is_email_verified BOOLEAN := FALSE;
    v_student_email VARCHAR(255);
    v_user_reward_id INT;
    v_status VARCHAR(10);
    v_voucher_code VARCHAR(100);
    v_brand_name VARCHAR(100);
    v_title VARCHAR(200);
    v_deal_id INT;
    v_vendor_id INT;
    v_qr_token VARCHAR(255);
    v_manual_code VARCHAR(100);
    v_existing_redemption RECORD;
BEGIN
    -- 0. Email Verification Check
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
            'message', 'Email verification required. Please verify your email address to redeem rewards.'
        );
    END IF;

    -- 1. Check if the user has unlocked this reward tier and get current status
    SELECT 
        sr.user_reward_id, 
        sr.status, 
        COALESCE(sr.voucher_code_issued, t.voucher_code) AS voucher_code, 
        v.name AS brand_name, 
        COALESCE(t.title, d.title) AS title,
        t.deal_id,
        t.vendor_id
    INTO v_user_reward_id, v_status, v_voucher_code, v_brand_name, v_title, v_deal_id, v_vendor_id
    FROM public.student_referral_rewards_t sr
    JOIN public.referral_reward_tiers_t t ON sr.tier_id = t.tier_id
    LEFT JOIN public.vendors_t v ON t.vendor_id = v.vendor_id
    LEFT JOIN public.deals_t d ON t.deal_id = d.deal_id
    WHERE sr.user_id = p_user_id 
      AND sr.tier_id = p_tier_id;

    IF v_user_reward_id IS NULL THEN
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE,
            'message', 'Reward tier is not unlocked yet.'
        );
    END IF;

    IF v_status = 'RDM' THEN
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE,
            'message', 'Reward has already been redeemed at vendor counter.',
            'voucher_code', v_voucher_code
        );
    END IF;

    -- 2. Check if active pending redemption already exists in deal_redemptions_t
    SELECT redemption_id, qr_code_token, manual_code, expires_at
    INTO v_existing_redemption
    FROM public.deal_redemptions_t
    WHERE user_id = p_user_id 
      AND user_reward_id = v_user_reward_id
      AND status = 'P'
      AND expires_at > (NOW() AT TIME ZONE 'Asia/Karachi')
    ORDER BY redemption_id DESC
    LIMIT 1;

    IF v_existing_redemption.redemption_id IS NOT NULL THEN
        v_qr_token := v_existing_redemption.qr_code_token;
        v_manual_code := v_existing_redemption.manual_code;
    ELSE
        -- Generate new QR Token (ZBR-prefix) & Manual Code (ZB + 4 Digits)
        v_qr_token := 'ZBR-' || gen_random_uuid()::text;
        LOOP
            v_manual_code := 'ZB' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.deal_redemptions_t 
                WHERE manual_code = v_manual_code AND status = 'P' AND expires_at > NOW()
            );
        END LOOP;

        INSERT INTO public.deal_redemptions_t (
            user_id, deal_id, user_reward_id, qr_code_token, manual_code, status, expires_at, created_date
        ) VALUES (
            p_user_id, 
            v_deal_id, 
            v_user_reward_id,
            v_qr_token, 
            v_manual_code, 
            'P', 
            ((NOW() AT TIME ZONE 'Asia/Karachi') + INTERVAL '30 minutes'),
            (NOW() AT TIME ZONE 'Asia/Karachi')
        );
    END IF;

    -- Default voucher_code to manual_code if null
    v_voucher_code := COALESCE(v_voucher_code, v_manual_code);

    -- Save issued code in student_referral_rewards_t
    UPDATE public.student_referral_rewards_t
    SET voucher_code_issued = v_voucher_code
    WHERE user_reward_id = v_user_reward_id;

    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'message', 'Reward redemption code generated! Show QR or manual code at vendor counter.',
        'brand_name', v_brand_name,
        'title', v_title,
        'voucher_code', v_voucher_code,
        'deal_id', v_deal_id,
        'qr_code_token', v_qr_token,
        'manual_code', v_manual_code,
        'redeemed_at', NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
