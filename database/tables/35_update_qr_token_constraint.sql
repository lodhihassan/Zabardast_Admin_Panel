-- ========================================================
-- Migration: Update qr_code_token constraint to allow 4-digit code reuse
-- ========================================================
ALTER TABLE public.deal_redemptions_t 
  DROP CONSTRAINT IF EXISTS deal_redemptions_t_qr_code_token_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_redemptions_active_qr 
  ON public.deal_redemptions_t (qr_code_token) 
  WHERE status = 'P';

