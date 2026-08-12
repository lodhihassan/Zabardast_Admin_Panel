-- Function to retrieve rich redemption history with multi-level filtering
CREATE OR REPLACE FUNCTION public.get_redemption_history(
    p_vendor_id INT DEFAULT NULL,
    p_branch_id INT DEFAULT NULL,
    p_search_term VARCHAR DEFAULT NULL,
    p_from_date DATE DEFAULT NULL,
    p_to_date DATE DEFAULT NULL,
    p_limit INT DEFAULT 100
)
RETURNS JSON AS $$
DECLARE
    v_results JSON;
BEGIN
    SELECT JSON_AGG(row_data) INTO v_results
    FROM (
        SELECT 
            rh.log_id,
            rh.redemption_id,
            rh.scanned_at,
            to_char(rh.scanned_at AT TIME ZONE 'Asia/Karachi', 'Mon DD, YYYY') AS formatted_date,
            to_char(rh.scanned_at AT TIME ZONE 'Asia/Karachi', 'HH12:MI AM') AS formatted_time,
            rh.total_bill_amount,
            rh.savings_amount,
            -- Referral Reward identification
            (dr.user_reward_id IS NOT NULL) AS is_referral_reward,
            CASE 
                WHEN dr.user_reward_id IS NOT NULL AND rh.deal_id IS NOT NULL THEN 'Referral Reward (Deal Linked)'
                WHEN dr.user_reward_id IS NOT NULL THEN 'Referral Reward'
                ELSE 'Regular Deal'
            END AS redemption_type_label,
            -- Title resolution: Reward title if referral reward, else Deal title
            COALESCE(r_tier.title, d.title, 'Referral Reward') AS deal_title,
            d.deal_id,
            d.discount_value,
            d.discount_type,
            -- Vendor info
            v.vendor_id,
            v.name AS vendor_name,
            -- Branch info
            b.branch_id,
            COALESCE(b.branch_name, 'Main Vendor Office / All Branches') AS branch_name,
            -- Student info
            sp.user_id AS student_user_id,
            sp.full_name AS student_name,
            u_stu.email AS student_email,
            sp.phone_number AS student_phone,
            inst.name AS student_institute,
            -- Vendor Staff (Cashier) info
            vu.user_id AS cashier_user_id,
            COALESCE(vu.full_name, 'Main Vendor Admin') AS cashier_name,
            u_cash.email AS cashier_email,
            vu.vendor_role AS cashier_role,
            -- Redemption token/code
            dr.manual_code,
            dr.qr_code_token
        FROM public.redemption_logs_history_t rh
        LEFT JOIN public.deal_redemptions_t dr ON dr.redemption_id = rh.redemption_id
        LEFT JOIN public.student_referral_rewards_t sr ON sr.user_reward_id = dr.user_reward_id
        LEFT JOIN public.referral_reward_tiers_t r_tier ON r_tier.tier_id = sr.tier_id
        LEFT JOIN public.deals_t d ON d.deal_id = COALESCE(rh.deal_id, r_tier.deal_id)
        LEFT JOIN public.vendors_t v ON v.vendor_id = COALESCE(rh.vendor_id, d.vendor_id, r_tier.vendor_id)
        LEFT JOIN public.branches_t b ON b.branch_id = rh.branch_id
        LEFT JOIN public.student_profiles_t sp ON sp.user_id = rh.user_id
        LEFT JOIN public.users_t u_stu ON u_stu.user_id = rh.user_id
        LEFT JOIN public.institutes_t inst ON inst.institute_id = sp.institute_id
        LEFT JOIN public.vendor_users_t vu ON vu.user_id = rh.cashier_id
        LEFT JOIN public.users_t u_cash ON u_cash.user_id = rh.cashier_id
        WHERE 
            (p_vendor_id IS NULL OR rh.vendor_id = p_vendor_id OR v.vendor_id = p_vendor_id)
            AND (p_branch_id IS NULL OR rh.branch_id = p_branch_id)
            AND (p_from_date IS NULL OR rh.scanned_at::DATE >= p_from_date)
            AND (p_to_date IS NULL OR rh.scanned_at::DATE <= p_to_date)
            AND (
                p_search_term IS NULL OR p_search_term = '' OR (
                    LOWER(COALESCE(r_tier.title, d.title, '')) LIKE '%' || LOWER(p_search_term) || '%' OR
                    LOWER(sp.full_name) LIKE '%' || LOWER(p_search_term) || '%' OR
                    LOWER(u_stu.email) LIKE '%' || LOWER(p_search_term) || '%' OR
                    LOWER(vu.full_name) LIKE '%' || LOWER(p_search_term) || '%' OR
                    LOWER(dr.manual_code) LIKE '%' || LOWER(p_search_term) || '%'
                )
            )
        ORDER BY rh.scanned_at DESC
        LIMIT p_limit
    ) row_data;

    RETURN COALESCE(v_results, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
