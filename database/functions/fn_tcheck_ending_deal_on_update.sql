CREATE OR REPLACE FUNCTION public.fn_check_ending_deal_on_update()
RETURNS TRIGGER AS $$
DECLARE
    v_now_pkt TIMESTAMP;
BEGIN
    v_now_pkt := (NOW() AT TIME ZONE 'Asia/Karachi');

    IF (NEW.is_active = TRUE AND NEW.valid_until IS NOT NULL) THEN
        IF (NEW.valid_until::timestamp >= v_now_pkt AND NEW.valid_until::timestamp <= (v_now_pkt + INTERVAL '48 hours')) THEN
            PERFORM public.fn_send_ending_deal_notification(NEW.deal_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
