-- ========================================================
-- Migration: Add deal_code to deals_t for Persistent Unique Deal Redemption Code
-- ========================================================
ALTER TABLE public.deals_t
  ADD COLUMN IF NOT EXISTS deal_code VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_deals_deal_code ON public.deals_t(deal_code);
