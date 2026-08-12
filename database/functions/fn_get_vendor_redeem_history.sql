CREATE OR REPLACE FUNCTION public.get_vendor_redeem_history(
    p_vendor_id INT,
    p_branch_id INT,
    p_tab_filter VARCHAR DEFAULT 'ALL'
) 
RETURNS JSON AS $$
DECLARE
    v_history_list JSON;
BEGIN
    SELECT COALESCE(JSON_AGG(row_to_json(t)), '[]'::json) INTO v_history_list
    FROM (
        SELECT 
            COALESCE(r_tier.title, d.title, 'Referral Reward') AS deal_title,
            CASE 
                WHEN dr.user_reward_id IS NOT NULL THEN 'Referral Reward'
                ELSE 'Redeemed'
            END AS status,
            sp.full_name AS student_name,
            COALESCE(inst.name, 'Unknown Institute') AS student_institute,
            UPPER(TO_CHAR(h.scanned_at AT TIME ZONE 'Asia/Karachi', 'MON FMDD')) AS group_date, 
            TO_CHAR(h.scanned_at AT TIME ZONE 'Asia/Karachi', 'HH12:MI AM') AS scan_time,
            h.scanned_at AS sort_date
            
        FROM public.redemption_logs_history_t h
        LEFT JOIN public.deal_redemptions_t dr ON dr.redemption_id = h.redemption_id
        LEFT JOIN public.student_referral_rewards_t sr ON sr.user_reward_id = dr.user_reward_id
        LEFT JOIN public.referral_reward_tiers_t r_tier ON r_tier.tier_id = sr.tier_id
        LEFT JOIN public.deals_t d ON d.deal_id = COALESCE(h.deal_id, r_tier.deal_id)
        JOIN public.student_profiles_t sp ON h.user_id = sp.user_id
        LEFT JOIN public.institutes_t inst ON inst.institute_id = sp.institute_id
        
        WHERE h.branch_id = p_branch_id
          AND (p_tab_filter = 'ALL' OR p_tab_filter = 'REDEEMED')
          
        ORDER BY sort_date DESC
    ) t;

    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'data', v_history_list
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
