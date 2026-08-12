-- ----------------------------------------------------------------
-- FUNCTION: Ending Deal Soon Global Broadcast
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_send_ending_deal_notification(p_deal_id INT)
RETURNS VOID AS $$
DECLARE
    v_vendor_name VARCHAR(255);
    v_deal_title VARCHAR(255);
    v_notification_title VARCHAR(255);
    v_notification_body TEXT;
    v_vendor_id INT;
BEGIN
    -- Prevent duplicate 'ED' alert if already sent for this deal
    IF EXISTS (
        SELECT 1 FROM public.global_notifications_t 
        WHERE deal_id = p_deal_id AND notification_type = 'ED'
    ) THEN
        RETURN;
    END IF;

    SELECT d.title, d.vendor_id, v.name 
    INTO v_deal_title, v_vendor_id, v_vendor_name
    FROM public.deals_t d
    JOIN public.vendors_t v ON d.vendor_id = v.vendor_id
    WHERE d.deal_id = p_deal_id;

    IF v_vendor_name IS NOT NULL THEN
        v_notification_title := v_vendor_name || ' is ending soon';
        v_notification_body  := COALESCE(v_deal_title, 'Flat discount ends today. Worth a last visit.');

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
            'ED', -- Ending Deal Soon (detail_id 34)
            p_deal_id,
            v_vendor_id,
            v_notification_title,
            v_notification_body,
            TRUE,
            'Ending Soon Trigger',
            (NOW() AT TIME ZONE 'Asia/Karachi')
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
