-- ----------------------------------------------------------------
-- FUNCTION: Mark All Notifications Read for Student
-- Handles both personal and global read logs
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_mark_all_notifications_read(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
    -- 1. Mark all personal notifications as read
    UPDATE public.user_notifications_t
    SET is_read = TRUE
    WHERE user_id = p_user_id AND is_read = FALSE;

    -- 2. Mark all active global notifications as read for this user
    INSERT INTO public.user_read_global_notifications_t (user_id, notification_id, read_date)
    SELECT p_user_id, gn.notification_id, NOW()
    FROM public.global_notifications_t gn
    WHERE gn.is_active = TRUE
    ON CONFLICT (user_id, notification_id) DO NOTHING;

    RETURN json_build_object(
        'success', TRUE,
        'message', 'All notifications marked as read'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
