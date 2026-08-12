-- ----------------------------------------------------------------
-- FUNCTION: Update Student Notification Preferences
-- Syncs toggle changes from Notification Settings UI
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_student_notification_settings(
    p_user_id UUID,
    p_new_offers BOOLEAN DEFAULT TRUE,
    p_offers_ending_soon BOOLEAN DEFAULT TRUE,
    p_new_brands BOOLEAN DEFAULT TRUE,
    p_referral_verified BOOLEAN DEFAULT TRUE,
    p_milestones BOOLEAN DEFAULT TRUE,
    p_nearby_deals BOOLEAN DEFAULT FALSE,
    p_announcements BOOLEAN DEFAULT TRUE
)
RETURNS JSON AS $$
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
        p_user_id,
        p_new_offers,
        p_offers_ending_soon,
        p_new_brands,
        p_referral_verified,
        p_milestones,
        p_nearby_deals,
        p_announcements,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        new_offers = EXCLUDED.new_offers,
        offers_ending_soon = EXCLUDED.offers_ending_soon,
        new_brands = EXCLUDED.new_brands,
        referral_verified = EXCLUDED.referral_verified,
        milestones = EXCLUDED.milestones,
        nearby_deals = EXCLUDED.nearby_deals,
        announcements = EXCLUDED.announcements,
        updated_date = NOW();

    RETURN json_build_object(
        'success', TRUE,
        'message', 'Notification settings updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
