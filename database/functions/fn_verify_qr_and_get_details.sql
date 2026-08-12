CREATE OR REPLACE FUNCTION public.verify_qr_and_get_details(
    p_code VARCHAR,    
    p_vendor_id INT,   
    p_branch_id INT    
)
RETURNS JSON AS $$
DECLARE
    v_redemption RECORD;
    v_deal RECORD;
    v_result JSON;
    v_current_day INT;
    v_has_branch_scope BOOLEAN;
    v_is_branch_valid BOOLEAN;
    v_new_vendor_expiry TIMESTAMPTZ; 
    
    -- Pakistan Local Time and Date variables
    v_current_local_time TIME := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::time;
    v_current_local_date DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::date;
BEGIN
    -- 1. Find Token or Manual Code
    SELECT dr.redemption_id, dr.user_id, dr.deal_id, dr.user_reward_id, dr.expires_at, dr.status
    INTO v_redemption
    FROM public.deal_redemptions_t dr
    WHERE (dr.qr_code_token = p_code OR dr.manual_code = UPPER(p_code));

    IF NOT FOUND THEN
        RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'Invalid QR Token or Manual Code.');
    END IF;

    -- 2. Check token expiration and status
    IF v_redemption.status != 'P' OR v_redemption.expires_at <= NOW() THEN
        IF v_redemption.status = 'P' THEN
            UPDATE public.deal_redemptions_t SET status = 'E' WHERE redemption_id = v_redemption.redemption_id;
        END IF;
        
        RETURN JSON_BUILD_OBJECT(
            'success', FALSE, 
            'message', CASE 
                           WHEN v_redemption.status = 'R' OR v_redemption.status = 'C' THEN 'This code has already been redeemed.'
                           ELSE 'This code has expired.'
                       END
        );
    END IF;

    -- 3. Fetch Deal / Reward data
    IF v_redemption.deal_id IS NOT NULL THEN
        SELECT vendor_id, is_active, valid_from, valid_until, valid_day_from, valid_day_to, start_time, end_time
        INTO v_deal
        FROM public.deals_t
        WHERE deal_id = v_redemption.deal_id;
    ELSIF v_redemption.user_reward_id IS NOT NULL THEN
        SELECT 
            t.vendor_id, 
            t.is_active, 
            CURRENT_DATE AS valid_from, 
            (CURRENT_DATE + INTERVAL '1 year')::DATE AS valid_until, 
            '1' AS valid_day_from, 
            '7' AS valid_day_to, 
            '00:00:00'::TIME AS start_time, 
            '23:59:59'::TIME AS end_time
        INTO v_deal
        FROM public.student_referral_rewards_t sr
        JOIN public.referral_reward_tiers_t t ON sr.tier_id = t.tier_id
        WHERE sr.user_reward_id = v_redemption.user_reward_id;
    END IF;

    -- Vendor Ownership Check
    IF v_deal.vendor_id IS NULL OR v_deal.vendor_id != p_vendor_id THEN
        RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'Unauthorized: This deal does not belong to this vendor.');
    END IF;

    -- Is Active Check
    IF v_deal.is_active IS NOT TRUE THEN
        RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is no longer active.');
    END IF;

    -- Date Range Check (PKT)
    IF v_current_local_date < v_deal.valid_from OR v_current_local_date > v_deal.valid_until THEN
        RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is not valid for today''s date.');
    END IF;

    -- Days of Week Check (PKT)
    IF v_deal.valid_day_from IS NOT NULL AND v_deal.valid_day_to IS NOT NULL THEN
        v_current_day := EXTRACT(ISODOW FROM v_current_local_date);
        IF v_deal.valid_day_from::text <= v_deal.valid_day_to::text THEN
            IF v_current_day::text < v_deal.valid_day_from::text OR v_current_day::text > v_deal.valid_day_to::text THEN
                RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is not available on this day of the week.');
            END IF;
        ELSE
            IF v_current_day::text < v_deal.valid_day_from::text AND v_current_day::text > v_deal.valid_day_to::text THEN
                RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is not available on this day of the week.');
            END IF;
        END IF;
    END IF;

    -- Time Check (PKT)
    IF v_deal.start_time IS NOT NULL AND v_deal.end_time IS NOT NULL THEN
        IF v_deal.start_time <= v_deal.end_time THEN
            IF v_current_local_time < v_deal.start_time OR v_current_local_time > v_deal.end_time THEN
                RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is not available at this time.');
            END IF;
        ELSE
            IF v_current_local_time < v_deal.start_time AND v_current_local_time > v_deal.end_time THEN
                RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is not available at this time.');
            END IF;
        END IF;
    END IF;

    -- Branch Scope Check (Only if deal_id is present)
    IF v_redemption.deal_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.deal_scope_t WHERE deal_id = v_redemption.deal_id AND branch_id IS NOT NULL) INTO v_has_branch_scope;
        IF v_has_branch_scope THEN
            SELECT EXISTS (SELECT 1 FROM public.deal_scope_t WHERE deal_id = v_redemption.deal_id AND branch_id = p_branch_id) INTO v_is_branch_valid;
            IF NOT v_is_branch_valid THEN
                RETURN JSON_BUILD_OBJECT('success', FALSE, 'message', 'This deal is not available at your branch.');
            END IF;
        END IF;
    END IF;

    -- RESET EXPIRY TIME FOR VENDOR (5 Mins to Confirm)
    UPDATE public.deal_redemptions_t 
    SET expires_at = NOW() + INTERVAL '5 minutes'
    WHERE redemption_id = v_redemption.redemption_id
    RETURNING expires_at INTO v_new_vendor_expiry;

    -- Return Details
    SELECT JSON_BUILD_OBJECT(
        'success', TRUE,
        'message', 'QR Code verified successfully.',
        'redemption_id', v_redemption.redemption_id,
        'expires_at', v_new_vendor_expiry, 
        
        -- Referral Reward Identification Flag
        'is_referral_reward', (v_redemption.user_reward_id IS NOT NULL),
        'user_reward_id', v_redemption.user_reward_id,
        'redemption_type_label', CASE WHEN v_redemption.user_reward_id IS NOT NULL THEN 'REFERRAL REWARD' ELSE 'REGULAR DEAL' END,
        
        -- Student Data
        'student_name', sp.full_name,
        'student_institute', COALESCE(inst.name, 'Unknown Institute'), 
        'student_profile_image', f_student_pic.file_path, 
        
        -- Deal & Vendor Data
        'deal_title', COALESCE(d.title, r_tier.title, 'Referral Reward'),
        'deal_banner_image', f_banner.file_path,
        'vendor_name', v.name,
        'vendor_logo', f_logo.file_path,
        'deal_tag', COALESCE(dt_tag.detail_name, 'Reward'),
        
        -- Fine Prints Array
        'fine_prints', CASE 
            WHEN d.deal_id IS NOT NULL THEN (
                SELECT COALESCE(JSON_AGG(fp.instruction ORDER BY fp.order_by ASC), '[]'::json)
                FROM public.deal_fine_print_t fp WHERE fp.deal_id = d.deal_id
            )
            ELSE '["Show this QR Code to cashier to claim your referral reward."]'::json
        END
    ) INTO v_result
    FROM public.student_profiles_t sp
    LEFT JOIN public.deals_t d ON d.deal_id = v_redemption.deal_id
    LEFT JOIN public.student_referral_rewards_t sr_rec ON sr_rec.user_reward_id = v_redemption.user_reward_id
    LEFT JOIN public.referral_reward_tiers_t r_tier ON r_tier.tier_id = sr_rec.tier_id
    LEFT JOIN public.vendors_t v ON v.vendor_id = COALESCE(d.vendor_id, r_tier.vendor_id)
    
    LEFT JOIN public.institutes_t inst ON inst.institute_id = sp.institute_id 
    LEFT JOIN public.uploaded_files_t f_student_pic ON f_student_pic.file_id::text = sp.profile_pic_file_id::text
    LEFT JOIN public.uploaded_files_t f_banner ON f_banner.file_id::text = d.banner_image_id::text
    LEFT JOIN public.uploaded_files_t f_logo ON f_logo.file_id::text = v.logo_file_id::text
    LEFT JOIN public.general_parameter_hd hd_tag ON hd_tag.description = 'DEAL_TAG'
    LEFT JOIN public.general_parameter_dt dt_tag ON dt_tag.header_id::text = hd_tag.header_id::text AND dt_tag.abbreviation::text = d.deal_tag::text
    WHERE sp.user_id = v_redemption.user_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
