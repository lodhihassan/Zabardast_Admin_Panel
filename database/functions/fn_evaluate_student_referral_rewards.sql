CREATE OR REPLACE FUNCTION public.fn_evaluate_student_referral_rewards(
    p_referrer_user_id UUID
)
RETURNS INT AS $$
DECLARE
    v_ref_code VARCHAR(50);
    v_verified_count INT := 0;
    v_tier RECORD;
    v_unlocked_count INT := 0;
BEGIN
    IF p_referrer_user_id IS NULL THEN
        RETURN 0;
    END IF;

    -- 1. Get referrer student's referral code
    SELECT referral_code INTO v_ref_code
    FROM public.student_profiles_t
    WHERE user_id = p_referrer_user_id;

    IF v_ref_code IS NULL OR v_ref_code = '' THEN
        RETURN 0;
    END IF;

    -- 2. Count total verified students referred by this code
    SELECT COUNT(*) INTO v_verified_count
    FROM public.student_profiles_t
    WHERE referred_by = v_ref_code
      AND is_verified = TRUE;

    -- 3. Loop through active reward tiers where required_referrals <= verified_count
    FOR v_tier IN 
        SELECT 
            t.tier_id, 
            COALESCE(v.name, 'Brand') AS brand_name, 
            COALESCE(t.title, d.title, 'Reward') AS title, 
            t.voucher_code
        FROM public.referral_reward_tiers_t t
        LEFT JOIN public.vendors_t v ON t.vendor_id = v.vendor_id
        LEFT JOIN public.deals_t d ON t.deal_id = d.deal_id
        WHERE t.is_active = TRUE
          AND t.required_referrals <= v_verified_count
        ORDER BY t.required_referrals ASC
    LOOP
        -- Insert reward with status 'RDY' (abbreviation from general_parameter_dt)
        INSERT INTO public.student_referral_rewards_t (
            user_id, tier_id, status, unlocked_at, voucher_code_issued
        ) VALUES (
            p_referrer_user_id, v_tier.tier_id, 'RDY', (NOW() AT TIME ZONE 'Asia/Karachi'), v_tier.voucher_code
        )
        ON CONFLICT (user_id, tier_id) DO NOTHING;

        IF FOUND THEN
            v_unlocked_count := v_unlocked_count + 1;

            -- Send Push Notification ('RU' - Reward Unlocked)
            INSERT INTO public.user_notifications_t (
                user_id, notification_type, title, body, is_read, created_date
            ) VALUES (
                p_referrer_user_id,
                'RU',
                'Reward Unlocked!',
                'Congratulations! You just unlocked ' || v_tier.brand_name || ' reward (' || v_tier.title || ') for referring your friends!',
                FALSE,
                (NOW() AT TIME ZONE 'Asia/Karachi')
            );
        END IF;
    END LOOP;

    RETURN v_unlocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
