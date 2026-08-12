-- ----------------------------------------------------------------
-- TRIGGER: Notification Settings Timestamp Auto-Update
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_update_notification_settings_timestamp ON public.user_notification_settings_t;

CREATE TRIGGER trg_update_notification_settings_timestamp
BEFORE UPDATE ON public.user_notification_settings_t
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_timestamp();
