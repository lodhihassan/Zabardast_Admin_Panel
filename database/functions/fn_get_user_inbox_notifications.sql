-- ----------------------------------------------------------------
-- FUNCTION: Get Unified Inbox Notifications (Mapped to Settings)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_get_user_inbox_notifications(p_user_id UUID)
RETURNS TABLE (
    notification_id UUID,
    notification_type VARCHAR(10),
    title VARCHAR(255),
    body TEXT,
    is_read BOOLEAN,
    created_date TIMESTAMP WITHOUT TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    -- 1. Personal Targeted Notifications (Filtered by Settings)
    SELECT 
        un.notification_id,
        un.notification_type,
        un.title,
        un.body,
        un.is_read,
        un.created_date
    FROM public.user_notifications_t un
    LEFT JOIN public.user_notification_settings_t s 
           ON s.user_id = p_user_id
    WHERE un.user_id = p_user_id
      AND (
          -- Core Account Status ('V' = Verified, 'R' = Reject) -> Always Delivered
          (un.notification_type IN ('V', 'R')) OR
          -- Referral Joined ('RJ') & Referral Verified ('RV') -> Check referral_verified setting
          (un.notification_type IN ('RJ', 'RV') AND COALESCE(s.referral_verified, TRUE) = TRUE) OR
          -- Reward Unlocked ('RU') -> Check milestones setting
          (un.notification_type = 'RU' AND COALESCE(s.milestones, TRUE) = TRUE) OR
          -- Other fallback
          (un.notification_type NOT IN ('RJ', 'RV', 'RU'))
      )

    UNION ALL

    -- 2. Global Broadcast Notifications (Filtered by Settings)
    SELECT 
        gn.notification_id,
        gn.notification_type,
        gn.title,
        gn.body,
        CASE WHEN r.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read,
        gn.created_date
    FROM public.global_notifications_t gn
    LEFT JOIN public.user_read_global_notifications_t r 
           ON gn.notification_id = r.notification_id AND r.user_id = p_user_id
    LEFT JOIN public.user_notification_settings_t s 
           ON s.user_id = p_user_id
    WHERE gn.is_active = TRUE
      AND (
          -- New Offers / Deals ('ND') -> Check new_offers setting
          (gn.notification_type = 'ND' AND COALESCE(s.new_offers, TRUE) = TRUE) OR
          -- Ending Deals Soon ('ED') -> Check offers_ending_soon setting
          (gn.notification_type = 'ED' AND COALESCE(s.offers_ending_soon, TRUE) = TRUE) OR
          -- New Brands ('NB') -> Check new_brands setting
          (gn.notification_type = 'NB' AND COALESCE(s.new_brands, TRUE) = TRUE) OR
          -- System Announcements ('SYS', 'W') -> Check announcements setting
          (gn.notification_type IN ('SYS', 'W') AND COALESCE(s.announcements, TRUE) = TRUE) OR
          -- Fallback
          (gn.notification_type NOT IN ('ND', 'ED', 'NB', 'SYS', 'W'))
      )

    ORDER BY created_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
