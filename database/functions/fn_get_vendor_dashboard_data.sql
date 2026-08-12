CREATE OR REPLACE FUNCTION public.get_vendor_dashboard_data(
    p_vendor_id INT,
    p_branch_id INT
) 
RETURNS JSON AS $$
DECLARE
    v_today_redemptions INT;
    v_today_value DECIMAL;
    v_recent_history JSON;
BEGIN
    -- 1. Get TODAY'S Stats (Count and Total Savings Value)
    SELECT 
        COALESCE(COUNT(*), 0),
        COALESCE(SUM(savings_amount), 0)
    INTO v_today_redemptions, v_today_value
    FROM public.redemption_logs_history_t
    WHERE branch_id = p_branch_id 
      AND scanned_at::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE;

    -- 2. Get TODAY'S Recent History (Top 10 for dashboard)
    SELECT COALESCE(JSON_AGG(row_to_json(t)), '[]'::json) INTO v_recent_history
    FROM (
        SELECT 
            d.title AS deal_title,
            'Redeemed' AS status,
            sp.full_name AS student_name,
            COALESCE(inst.name, 'Unknown Institute') AS student_institute,
            TO_CHAR(h.scanned_at AT TIME ZONE 'Asia/Karachi', 'HH12:MI AM') AS scan_time
        FROM public.redemption_logs_history_t h
        JOIN public.deals_t d ON h.deal_id = d.deal_id
        JOIN public.student_profiles_t sp ON h.user_id = sp.user_id
        LEFT JOIN public.institutes_t inst ON inst.institute_id = sp.institute_id
        
        WHERE h.branch_id = p_branch_id
          AND h.scanned_at::DATE = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE
        ORDER BY h.scanned_at DESC
        LIMIT 10
    ) t;

    -- 3. Return Combined JSON Object
    RETURN JSON_BUILD_OBJECT(
        'success', TRUE,
        'today_redemptions', v_today_redemptions,
        'today_value', v_today_value,
        'recent_history', v_recent_history
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
