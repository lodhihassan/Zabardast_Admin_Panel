CREATE OR REPLACE FUNCTION public.fn_get_admin_student_referral_rewards_log(
    p_status VARCHAR DEFAULT NULL,
    p_search VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT COALESCE(JSON_AGG(
        JSON_BUILD_OBJECT(
            'user_reward_id', sr.user_reward_id,
            'user_id', sr.user_id,
            'student_name', sp.full_name,
            'phone_number', sp.phone_number,
            'tier_id', t.tier_id,
            'required_referrals', t.required_referrals,
            'vendor_name', COALESCE(v.name, 'Unknown Vendor'),
            'vendor_logo_url', f.file_path,
            'deal_id', t.deal_id,
            'deal_title', COALESCE(d.title, 'N/A'),
            'reward_title', t.title,
            'reward_sub_text', COALESCE(t.reward_sub_text, ''),
            'status', sr.status,
            'status_name', COALESCE(dt.detail_name, sr.status),
            'unlocked_at', CASE WHEN sr.unlocked_at IS NOT NULL THEN to_char(sr.unlocked_at, 'DD/MM/YYYY, HH12:MI:SS AM') ELSE NULL END,
            'redeemed_at', CASE WHEN sr.redeemed_at IS NOT NULL THEN to_char(sr.redeemed_at, 'DD/MM/YYYY, HH12:MI:SS AM') ELSE NULL END,
            'voucher_code_issued', sr.voucher_code_issued
        ) ORDER BY sr.unlocked_at DESC
    ), '[]'::json) INTO v_result
    FROM public.student_referral_rewards_t sr
    JOIN public.student_profiles_t sp ON sr.user_id = sp.user_id
    JOIN public.referral_reward_tiers_t t ON sr.tier_id = t.tier_id
    LEFT JOIN public.vendors_t v ON t.vendor_id = v.vendor_id
    LEFT JOIN public.uploaded_files_t f ON v.logo_file_id = f.file_id
    LEFT JOIN public.deals_t d ON t.deal_id = d.deal_id
    LEFT JOIN public.general_parameter_hd hd ON hd.description = 'REFERRAL_REWARD_STATUS'
    LEFT JOIN public.general_parameter_dt dt ON dt.header_id = hd.header_id AND dt.abbreviation = sr.status
    WHERE (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR sr.status = p_status)
      AND (p_search IS NULL OR p_search = '' OR 
           sp.full_name ILIKE '%' || p_search || '%' OR 
           sp.phone_number ILIKE '%' || p_search || '%' OR 
           v.name ILIKE '%' || p_search || '%' OR 
           t.title ILIKE '%' || p_search || '%');

    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'logs', v_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
