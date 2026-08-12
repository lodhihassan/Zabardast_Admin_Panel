-- ----------------------------------------------------------------
-- PATCH SCRIPT: Allow Nullable deal_id for Stand-alone Referral Rewards
-- ----------------------------------------------------------------

ALTER TABLE public.deal_redemptions_t ALTER COLUMN deal_id DROP NOT NULL;
ALTER TABLE public.redemption_logs_history_t ALTER COLUMN deal_id DROP NOT NULL;
