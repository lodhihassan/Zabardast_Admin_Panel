-- ----------------------------------------------------------------
-- CRON FUNCTION: Scheduled Check for Expiring Deals (PKT Timezone)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_check_ending_deals_cron()
RETURNS VOID AS $$
DECLARE
    v_now_pkt TIMESTAMP;
    rec RECORD;
BEGIN
    v_now_pkt := (NOW() AT TIME ZONE 'Asia/Karachi');

    FOR rec IN 
        SELECT d.deal_id
        FROM public.deals_t d
        WHERE d.is_active = TRUE
          AND d.valid_until IS NOT NULL
          AND d.valid_until::timestamp >= v_now_pkt
          AND d.valid_until::timestamp <= (v_now_pkt + INTERVAL '48 hours')
          AND NOT EXISTS (
              SELECT 1 FROM public.global_notifications_t g
              WHERE g.deal_id = d.deal_id AND g.notification_type = 'ED'
          )
    LOOP
        PERFORM public.fn_send_ending_deal_notification(rec.deal_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------
-- Supabase pg_cron Schedule Command
-- NOTE: 0 19 * * * = UTC 7:00 PM = PKT 12:00 AM Midnight
-- ----------------------------------------------------------------
-- SELECT cron.schedule(
--     'check-ending-deals-daily',
--     '0 19 * * *',
--     $$ SELECT public.fn_check_ending_deals_cron(); $$
-- );
