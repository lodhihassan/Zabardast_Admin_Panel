-- ----------------------------------------------------------------
-- TRIGGER: New Deal Drop Inbox Notification
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_new_deal_notification ON public.deals_t;

CREATE TRIGGER trg_new_deal_notification
AFTER INSERT ON public.deals_t
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_new_deal_notification();
