CREATE OR REPLACE FUNCTION public.fn_get_student_referral_dashboard(
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_ref_code VARCHAR(50);
    v_total_joined INT := 0;
    v_total_verified INT := 0;
    v_next_tier RECORD;
    v_is_all_unlocked BOOLEAN := FALSE;
    v_rewards_json JSON;
    v_next_tier_json JSON := NULL;
    v_share_link TEXT;
BEGIN
    -- 1. Fetch student referral code
    SELECT referral_code INTO v_ref_code
    FROM public.student_profiles_t
    WHERE user_id = p_user_id;

    IF v_ref_code IS NULL THEN
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE,
            'message', 'Student profile or referral code not found'
        );
    END IF;

    -- Build default share link (pointing to Supabase referral-share Edge Function)
    v_share_link := 'https://ypxbpwufoioxnvixwmqq.supabase.co/functions/v1/referral-share?code=' || v_ref_code;

    -- 2. Count total joined friends and verified friends
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE is_verified = TRUE)
    INTO v_total_joined, v_total_verified
    FROM public.student_profiles_t
    WHERE referred_by = v_ref_code;

    -- 3. Evaluate rewards first to ensure up-to-date state
    PERFORM public.fn_evaluate_student_referral_rewards(p_user_id);

    -- 4. Find next locked tier milestone
    SELECT 
        t.tier_id, 
        t.required_referrals, 
        COALESCE(v.name, 'Next Reward') AS brand_name
    INTO v_next_tier
    FROM public.referral_reward_tiers_t t
    LEFT JOIN public.vendors_t v ON t.vendor_id = v.vendor_id
    WHERE t.is_active = TRUE
      AND t.required_referrals > v_total_verified
    ORDER BY t.required_referrals ASC
    LIMIT 1;

    IF v_next_tier.tier_id IS NOT NULL THEN
        v_next_tier_json := JSON_BUILD_OBJECT(
            'tier_id', v_next_tier.tier_id,
            'required_referrals', v_next_tier.required_referrals,
            'brand_name', v_next_tier.brand_name,
            'remaining_referrals', (v_next_tier.required_referrals - v_total_verified),
            'progress_text', (v_next_tier.required_referrals - v_total_verified)::text || ' more to unlock ' || v_next_tier.brand_name || '.'
        );
    ELSE
        -- All rewards unlocked
        v_is_all_unlocked := TRUE;
    END IF;

    -- 5. Build rewards list joining vendors_t, deals_t, and uploaded_files_t
    WITH raw_rewards AS (
        SELECT 
            t.tier_id,
            t.vendor_id,
            t.deal_id,
            v.name AS brand_name,
            COALESCE(v.rating, 5.0) AS vendor_rating,
            UPPER(SUBSTRING(v.name FROM 1 FOR 2)) AS brand_initials,
            f.file_path AS brand_logo_url,
            COALESCE(t.title, d.title) AS title,
            t.reward_badge_text AS custom_badge_text,
            t.reward_sub_text,
            t.required_referrals,
            CASE 
                WHEN sr.status IS NOT NULL THEN sr.status
                WHEN v_total_verified >= t.required_referrals THEN 'RDY'
                ELSE 'LCK'
            END AS status_abbr,
            sr.unlocked_at,
            sr.redeemed_at,
            CASE WHEN sr.status = 'RDM' THEN sr.voucher_code_issued ELSE NULL END AS voucher_code
        FROM public.referral_reward_tiers_t t
        LEFT JOIN public.vendors_t v ON t.vendor_id = v.vendor_id
        LEFT JOIN public.uploaded_files_t f ON v.logo_file_id = f.file_id
        LEFT JOIN public.deals_t d ON t.deal_id = d.deal_id
        LEFT JOIN public.student_referral_rewards_t sr 
               ON t.tier_id = sr.tier_id AND sr.user_id = p_user_id
        WHERE t.is_active = TRUE
    )
    SELECT COALESCE(JSON_AGG(
        JSON_BUILD_OBJECT(
            'tier_id', r.tier_id,
            'vendor_id', r.vendor_id,
            'deal_id', r.deal_id,
            'brand_name', r.brand_name,
            'vendor_rating', r.vendor_rating,
            'brand_initials', COALESCE(r.brand_initials, 'BR'),
            'brand_logo_url', r.brand_logo_url,
            'title', r.title,
            'reward_sub_text', COALESCE(r.reward_sub_text, ''),
            'status', r.status_abbr,
            'status_name', CASE 
                WHEN r.status_abbr = 'LCK' THEN 'Locked'
                WHEN r.status_abbr = 'RDM' THEN 'Redeemed'
                ELSE 'Ready'
            END,
            'reward_badge_text', CASE 
                WHEN r.status_abbr = 'LCK' THEN 'Locked'
                WHEN r.status_abbr = 'RDM' THEN 'Redeemed'
                ELSE COALESCE(r.custom_badge_text, 'Ready')
            END,
            'required_referrals', r.required_referrals,
            'unlocked_at', r.unlocked_at,
            'redeemed_at', r.redeemed_at,
            'voucher_code', r.voucher_code
        ) ORDER BY r.required_referrals ASC
    ), '[]'::json) INTO v_rewards_json
    FROM raw_rewards r;

    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'referral_code', v_ref_code,
        'share_link', v_share_link,
        'total_joined', v_total_joined,
        'total_verified', v_total_verified,
        'next_tier', v_next_tier_json,
        'is_all_unlocked', v_is_all_unlocked,
        'rewards', v_rewards_json
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
