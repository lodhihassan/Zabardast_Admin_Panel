-- ================================================================
-- CRON JOB: Deactivate Expired Deals (Rozana Midnight PKT)
-- Schedule: 0 0 * * * (Every day at 12:00 AM UTC = 5:00 AM PKT)
-- NOTE: Supabase pg_cron UTC me chalta hai.
--       Pakistan midnight = UTC 19:00 (7:00 PM UTC previous day)
--       Isliye schedule '0 19 * * *' use karein PKT midnight ke liye.
-- ================================================================

-- STEP 1: Enable pg_cron Extension (Run once as superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ================================================================
-- STEP 2: Schedule the Cron Job
-- ================================================================
SELECT cron.schedule(
    'deactivate_expired_deals',     -- Unique job name
    '0 19 * * *',                   -- 7:00 PM UTC = 12:00 AM PKT (Midnight Pakistan)
    $$
        UPDATE public.deals_t
        SET is_active = FALSE
        WHERE valid_until < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::date
          AND is_active = TRUE;
    $$
);

-- ================================================================
-- UTILITY QUERIES (Run manually when needed)
-- ================================================================

-- All scheduled cron jobs check karne ke liye:
-- SELECT * FROM cron.job;

-- Specific job unschedule karne ke liye (job_id use karein):
-- SELECT cron.unschedule('deactivate_expired_deals');

-- Recent cron run history check karne ke liye:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
