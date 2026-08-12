DROP TRIGGER IF EXISTS trg_ending_deal_update ON public.deals_t;

CREATE TRIGGER trg_ending_deal_update
AFTER UPDATE OF valid_until, is_active ON public.deals_t
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_check_ending_deal_on_update();
