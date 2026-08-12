-- ----------------------------------------------------------------
-- PATCH SCRIPT: Add rating column to vendors_t table
-- ----------------------------------------------------------------

ALTER TABLE public.vendors_t ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 5.00;
