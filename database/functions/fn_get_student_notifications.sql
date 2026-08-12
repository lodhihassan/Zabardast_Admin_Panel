-- ----------------------------------------------------------------
-- FUNCTION: Get Student Notifications (Filtered by Preferences & Settings Update Date)
-- Only returns notifications created ON or AFTER student's settings update / signup date
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_get_student_notifications(p_user_id UUID)
RETURNS TABLE (
    notification_id UUID,
    notification_type TEXT,
    icon_type TEXT,
    action_type TEXT,
    title TEXT,
    body TEXT,
    deal_id INT,
    deal_title TEXT,
    vendor_id INT,
    vendor_name TEXT,
    vendor_logo_url TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMP WITHOUT TIME ZONE,
    time_ago TEXT
) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    WITH user_info AS (
        SELECT 
            COALESCE(
                GREATEST(u.created_date, s.updated_date),
                u.created_date,
                s.updated_date,
                NOW() - INTERVAL '365 days'
            ) AS effective_start_date
        FROM (SELECT 1) dummy
        LEFT JOIN public.users_t u ON u.user_id = p_user_id
        LEFT JOIN public.user_notification_settings_t s ON s.user_id = p_user_id
    ),
    settings AS (
        SELECT 
            COALESCE(s.new_offers, TRUE) AS new_offers,
            COALESCE(s.offers_ending_soon, TRUE) AS offers_ending_soon,
            COALESCE(s.new_brands, TRUE) AS new_brands,
            COALESCE(s.referral_verified, TRUE) AS referral_verified,
            COALESCE(s.milestones, TRUE) AS milestones,
            COALESCE(s.nearby_deals, FALSE) AS nearby_deals,
            COALESCE(s.announcements, TRUE) AS announcements
        FROM (SELECT 1) dummy
        LEFT JOIN public.user_notification_settings_t s ON s.user_id = p_user_id
    ),
    raw_notifications AS (
        -- 1. Personal Targeted Notifications (User Specific)
        SELECT 
            un.notification_id,
            un.notification_type::TEXT AS notification_type,
            un.title::TEXT AS title,
            un.body::TEXT AS body,
            NULL::INT AS deal_id,
            NULL::INT AS vendor_id,
            un.is_read,
            un.created_date
        FROM public.user_notifications_t un, settings s
        WHERE un.user_id = p_user_id
          AND (
              -- Always allow Account Verification status ('V', 'R')
              (un.notification_type IN ('V', 'R')) OR
              -- Referral Joined ('RJ') & Referral Verified ('RV') -> Check referral_verified setting
              (un.notification_type IN ('RJ', 'RV') AND s.referral_verified = TRUE) OR
              -- Reward Unlocked / Savings Milestone ('RU') -> Check milestones setting
              (un.notification_type = 'RU' AND s.milestones = TRUE) OR
              -- Generic fallback for unspecified personal notifications
              (un.notification_type NOT IN ('RJ', 'RV', 'RU', 'V', 'R'))
          )

        UNION ALL

        -- 2. Global Broadcast Notifications (Only Created ON or AFTER Settings/Signup Update Date)
        SELECT 
            gn.notification_id,
            gn.notification_type::TEXT AS notification_type,
            gn.title::TEXT AS title,
            gn.body::TEXT AS body,
            gn.deal_id,
            gn.vendor_id,
            CASE WHEN r.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read,
            gn.created_date
        FROM public.global_notifications_t gn
        LEFT JOIN public.user_read_global_notifications_t r 
               ON gn.notification_id = r.notification_id AND r.user_id = p_user_id,
             settings s,
             user_info ui
        WHERE gn.is_active = TRUE
          AND gn.created_date >= ui.effective_start_date -- ONLY NOTIFICATIONS AFTER SETTINGS TOGGLE UPDATE
          AND (
              -- New Offers ('ND') -> Check new_offers setting
              (gn.notification_type = 'ND' AND s.new_offers = TRUE) OR
              -- Ending Deals ('ED') -> Check offers_ending_soon setting
              (gn.notification_type = 'ED' AND s.offers_ending_soon = TRUE) OR
              -- New Brands in City ('NB') -> Check new_brands setting
              (gn.notification_type = 'NB' AND s.new_brands = TRUE) OR
              -- Announcements ('SYS', 'W') -> Check announcements setting
              (gn.notification_type IN ('SYS', 'W') AND s.announcements = TRUE) OR
              -- Nearby Deals ('ND_NEARBY') -> Check nearby_deals setting
              (gn.notification_type = 'ND_NEARBY' AND s.nearby_deals = TRUE) OR
              -- Generic fallback for unspecified global notifications
              (gn.notification_type NOT IN ('ND', 'ED', 'NB', 'SYS', 'W', 'ND_NEARBY'))
          )
    )
    SELECT 
        n.notification_id,
        n.notification_type,
        CASE 
            WHEN n.notification_type IN ('ND', 'NB') THEN 'lightning'
            WHEN n.notification_type = 'ED' THEN 'clock'
            WHEN n.notification_type IN ('RJ', 'RV') THEN 'person'
            WHEN n.notification_type = 'RU' THEN 'gift'
            WHEN n.notification_type = 'V' THEN 'check'
            WHEN n.notification_type IN ('W', 'SYS') THEN 'sparkle'
            ELSE 'sparkle'
        END::TEXT AS icon_type,
        CASE 
            WHEN n.notification_type IN ('ND', 'ED') THEN 'DEAL_DETAILS'
            WHEN n.notification_type = 'NB' THEN 'VENDOR_PROFILE'
            WHEN n.notification_type IN ('RJ', 'RV') THEN 'REFERRAL'
            WHEN n.notification_type = 'RU' THEN 'REWARDS'
            WHEN n.notification_type IN ('V', 'R') THEN 'VERIFICATION'
            ELSE 'ANNOUNCEMENT'
        END::TEXT AS action_type,
        n.title,
        n.body,
        n.deal_id,
        d.title::TEXT AS deal_title,
        COALESCE(n.vendor_id, d.vendor_id) AS vendor_id,
        v.name::TEXT AS vendor_name,
        CASE 
            WHEN uf.file_path IS NOT NULL THEN 
                CONCAT('https://ypxbpwufoioxnvixwmqq.supabase.co/storage/v1/object/public/vendors/', REPLACE(uf.file_path, 'vendors/', ''))
            ELSE NULL 
        END::TEXT AS vendor_logo_url,
        n.is_read,
        n.created_date AS created_at,
        CASE 
            WHEN NOW() - n.created_date < INTERVAL '1 minute' THEN 'Just now'
            WHEN NOW() - n.created_date < INTERVAL '1 hour' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM (NOW() - n.created_date)) / 60)::INT, 'm ago')
            WHEN NOW() - n.created_date < INTERVAL '1 day' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM (NOW() - n.created_date)) / 3600)::INT, 'h ago')
            WHEN NOW() - n.created_date < INTERVAL '30 days' THEN CONCAT(FLOOR(EXTRACT(EPOCH FROM (NOW() - n.created_date)) / 86400)::INT, 'd ago')
            ELSE TO_CHAR(n.created_date, 'DD Mon')
        END::TEXT AS time_ago
    FROM raw_notifications n
    LEFT JOIN public.deals_t d ON n.deal_id = d.deal_id
    LEFT JOIN public.vendors_t v ON COALESCE(n.vendor_id, d.vendor_id) = v.vendor_id
    LEFT JOIN public.uploaded_files_t uf ON v.logo_file_id = uf.file_id
    ORDER BY n.created_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
