-- ----------------------------------------------------------------
-- FUNCTION: New Deal Drop Global Broadcast (Supports 1hr, 6hr, 12hr Flash Deals)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_handle_new_deal_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_name VARCHAR(255);
    v_notification_title VARCHAR(255);
    v_notification_body TEXT;
    v_now_pkt TIMESTAMP;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.is_active = TRUE) THEN

        v_now_pkt := (NOW() AT TIME ZONE 'Asia/Karachi');

        -- Fetch vendor name from vendors_t
        SELECT name INTO v_vendor_name
        FROM public.vendors_t
        WHERE vendor_id = NEW.vendor_id;

        IF v_vendor_name IS NULL THEN
            v_vendor_name := 'Partner Brand';
        END IF;

        -- Format Title: "New drop from <Vendor Name>"
        v_notification_title := 'New drop from ' || v_vendor_name;
        v_notification_body  := COALESCE(NEW.title, 'New student deal is now live. Tap to take a look.');

        -- 1. Insert New Deal Drop Notification ('ND')
        INSERT INTO public.global_notifications_t (
            notification_type,
            deal_id,
            vendor_id,
            title,
            body,
            is_active,
            created_by,
            created_date
        ) VALUES (
            'ND', -- New Deal abbreviation (detail_id 33)
            NEW.deal_id,
            NEW.vendor_id,
            v_notification_title,
            v_notification_body,
            TRUE,
            NEW.created_by,
            v_now_pkt
        );

        -- 2. Hourly/Hourly Flash Deal Check: If deal expires within 24 hours (1hr, 6hr, 12hr or same day), ALSO trigger 'ED' (Ending Soon)!
        IF (NEW.valid_until IS NOT NULL AND NEW.valid_until::timestamp <= (v_now_pkt + INTERVAL '24 hours')) THEN
            PERFORM public.fn_send_ending_deal_notification(NEW.deal_id);
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
