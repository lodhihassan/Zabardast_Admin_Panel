CREATE OR REPLACE FUNCTION public.process_deal_redemption(
    p_code VARCHAR,
    p_cashier_id UUID,
    p_vendor_id INT,
    p_branch_id INT,
    p_total_bill_amount DECIMAL DEFAULT 0,
    p_savings_amount DECIMAL DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_redemption RECORD;
    v_deal RECORD;
    v_reward_tier RECORD;
    v_today_redemptions INT;
    v_student_name VARCHAR;
    v_institute_name VARCHAR;
    v_deal_title VARCHAR;
    v_vendor_name VARCHAR;
BEGIN
    -- 1. Token or Manual Code Check
    SELECT redemption_id, user_id, deal_id, user_reward_id INTO v_redemption
    FROM public.deal_redemptions_t
    WHERE (qr_code_token = p_code OR manual_code = UPPER(p_code)) 
      AND status = 'P' 
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'Invalid or expired QR Token or Manual Code.');
    END IF;

    -- 2. If Deal-based redemption, validate Deal details
    IF v_redemption.deal_id IS NOT NULL THEN
        SELECT vendor_id, is_active, redeem_limit_per_day, title INTO v_deal
        FROM public.deals_t WHERE deal_id = v_redemption.deal_id;

        IF v_deal.vendor_id != p_vendor_id THEN
            RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'Unauthorized: This deal does not belong to this vendor.');
        END IF;

        IF v_deal.is_active = FALSE THEN
            RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is no longer active.');
        END IF;

        -- Daily Limit Check for Deals
        IF v_deal.redeem_limit_per_day IS NOT NULL AND v_deal.redeem_limit_per_day > 0 THEN
            SELECT COUNT(*) INTO v_today_redemptions
            FROM public.redemption_logs_history_t
            WHERE user_id = v_redemption.user_id 
              AND deal_id = v_redemption.deal_id 
              AND scanned_at::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE;

            IF v_today_redemptions >= v_deal.redeem_limit_per_day THEN
                UPDATE public.deal_redemptions_t SET status = 'E' WHERE redemption_id = v_redemption.redemption_id;
                RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'Limit Exceeded: Daily redemption limit reached.');
            END IF;
        END IF;

        v_deal_title := v_deal.title;

    -- 3. If Referral Reward redemption (without deal_id)
    ELSIF v_redemption.user_reward_id IS NOT NULL THEN
        SELECT t.vendor_id, t.is_active, t.title INTO v_reward_tier
        FROM public.student_referral_rewards_t sr
        JOIN public.referral_reward_tiers_t t ON sr.tier_id = t.tier_id
        WHERE sr.user_reward_id = v_redemption.user_reward_id;

        IF v_reward_tier.vendor_id != p_vendor_id THEN
            RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'Unauthorized: This referral reward does not belong to this vendor.');
        END IF;

        IF v_reward_tier.is_active = FALSE THEN
            RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This referral reward tier is no longer active.');
        END IF;

        v_deal_title := v_reward_tier.title;
    END IF;

    -- 4. Update status in deal_redemptions_t to 'R' (Redeemed)
    UPDATE public.deal_redemptions_t SET status = 'R' WHERE redemption_id = v_redemption.redemption_id;

    -- 5. If this was a Referral Reward, UPDATE student_referral_rewards_t status to 'RDM'!
    IF v_redemption.user_reward_id IS NOT NULL THEN
        UPDATE public.student_referral_rewards_t
        SET status = 'RDM',
            redeemed_at = (NOW() AT TIME ZONE 'Asia/Karachi')
        WHERE user_reward_id = v_redemption.user_reward_id;
    END IF;

    -- 6. Insert History Log
    INSERT INTO public.redemption_logs_history_t (
        redemption_id, user_id, deal_id, vendor_id, branch_id, cashier_id, total_bill_amount, savings_amount
    ) VALUES (
        v_redemption.redemption_id, v_redemption.user_id, v_redemption.deal_id, 
        p_vendor_id, p_branch_id, p_cashier_id, p_total_bill_amount, p_savings_amount
    );

    -- 7. Fetch Student and Vendor details for UI response
    SELECT sp.full_name, COALESCE(inst.name, ''), v.name
    INTO v_student_name, v_institute_name, v_vendor_name
    FROM public.student_profiles_t sp
    LEFT JOIN public.institutes_t inst ON inst.institute_id = sp.institute_id
    JOIN public.vendors_t v ON v.vendor_id = p_vendor_id
    WHERE sp.user_id = v_redemption.user_id;

    -- 8. Return Final Response
    RETURN JSON_BUILD_OBJECT(
        'success', TRUE, 
        'message', 'Reward / Deal successfully redeemed!',
        'discount_text', COALESCE(v_deal_title, 'Referral Reward') || ' · ' || v_vendor_name,
        'student_info', v_student_name || ' · ' || v_institute_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
