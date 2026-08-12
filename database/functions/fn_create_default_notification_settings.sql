-- ----------------------------------------------------------------
-- FUNCTION: Auto-create Default User Notification Preferences
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_create_default_notification_settings()
RETURNS TRIGGER AS 
BEGIN
    INSERT INTO public.user_notification_settings_t (
        user_id,
        new_offers,
        offers_ending_soon,
        new_brands,
        referral_verified,
        milestones,
        nearby_deals,
        announcements,
        updated_date
    ) VALUES (
        NEW.user_id,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        FALSE,
        TRUE,
        (NOW() AT TIME ZONE 'Asia/Karachi')
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
