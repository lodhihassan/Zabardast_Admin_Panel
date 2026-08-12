-- ----------------------------------------------------------------
-- TRIGGER: Auto Create Default Notification Settings
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_create_default_notification_settings ON public.users_t;

CREATE TRIGGER trg_create_default_notification_settings
AFTER INSERT ON public.users_t
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_default_notification_settings();
