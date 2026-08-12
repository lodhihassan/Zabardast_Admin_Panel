CREATE OR REPLACE FUNCTION public.get_student_redeem_history(
    p_user_id UUID
) 
RETURNS JSON AS $$
DECLARE
    v_total_saved DECIMAL := 0;
    v_total_redemptions INT := 0;
    v_history_list JSON;
BEGIN
    -- 1. Get Top Level Stats
    SELECT 
        COALESCE(SUM(savings_amount), 0)
    INTO v_total_saved
    FROM public.redemption_logs_history_t
    WHERE user_id = p_user_id;

    SELECT COUNT(redemption_id)
    INTO v_total_redemptions
    FROM public.deal_redemptions_t
    WHERE user_id = p_user_id AND status IN ('R', 'E');

    -- 2. Fetch Complete History (Deals & Referral Rewards)
    SELECT COALESCE(JSON_AGG(row_to_json(t)), '[]'::json) INTO v_history_list
    FROM (
        SELECT 
            COALESCE(v.name, 'Vendor') AS vendor_name,
            f_logo.file_path AS vendor_logo,
            COALESCE(r_tier.title, d.title, 'Referral Reward') AS deal_title,
            CASE WHEN dr.status = 'R' THEN 'REDEEMED' ELSE 'EXPIRED' END AS status,
            (dr.user_reward_id IS NOT NULL) AS is_referral_reward,
            CASE WHEN dr.user_reward_id IS NOT NULL THEN 'Referral Reward' ELSE 'Regular Deal' END AS redemption_type_label,
            COALESCE(b.branch_name, b.location, 'Main Branch') AS location,
            UPPER(TO_CHAR(COALESCE(h.scanned_at, dr.created_date, dr.expires_at) AT TIME ZONE 'Asia/Karachi', 'FMMONTH YYYY')) AS month_group,
            TO_CHAR(COALESCE(h.scanned_at, dr.created_date, dr.expires_at) AT TIME ZONE 'Asia/Karachi', 'FMDD Mon, HH12:MI AM') AS formatted_datetime,
            COALESCE(h.scanned_at, dr.created_date, dr.expires_at) AS sort_date
            
        FROM public.deal_redemptions_t dr
        LEFT JOIN public.student_referral_rewards_t sr ON sr.user_reward_id = dr.user_reward_id
        LEFT JOIN public.referral_reward_tiers_t r_tier ON r_tier.tier_id = sr.tier_id
        LEFT JOIN public.deals_t d ON d.deal_id = COALESCE(dr.deal_id, r_tier.deal_id)
        LEFT JOIN public.vendors_t v ON v.vendor_id = COALESCE(d.vendor_id, r_tier.vendor_id)
        LEFT JOIN public.uploaded_files_t f_logo ON f_logo.file_id::text = v.logo_file_id::text
        LEFT JOIN public.redemption_logs_history_t h ON h.redemption_id = dr.redemption_id
        LEFT JOIN public.branches_t b ON b.branch_id = h.branch_id
        
        WHERE dr.user_id = p_user_id
          AND dr.status IN ('R', 'E')
        ORDER BY sort_date DESC
    ) t;

    -- 3. Return Combined JSON
    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'total_saved_amount', v_total_saved,
        'total_redemptions', v_total_redemptions,
        'history_data', v_history_list
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
