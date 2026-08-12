-- ----------------------------------------------------------------
-- FUNCTION: Get Student Notification Settings
-- Fixed 42702 ambiguity with #variable_conflict use_column
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_get_student_notification_settings(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    new_offers BOOLEAN,
    offers_ending_soon BOOLEAN,
    new_brands BOOLEAN,
    referral_verified BOOLEAN,
    milestones BOOLEAN,
    nearby_deals BOOLEAN,
    announcements BOOLEAN,
    updated_date TIMESTAMP WITHOUT TIME ZONE
) AS $$
#variable_conflict use_column
BEGIN
    -- Ensure row exists with defaults if not created yet
    INSERT INTO public.user_notification_settings_t (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN QUERY
    SELECT 
        s.user_id,
        s.new_offers,
        s.offers_ending_soon,
        s.new_brands,
        s.referral_verified,
        s.milestones,
        s.nearby_deals,
        s.announcements,
        s.updated_date
    FROM public.user_notification_settings_t s
    WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
