CREATE TABLE IF NOT EXISTS public.referral_reward_tiers_t (
    tier_id SERIAL PRIMARY KEY,
    required_referrals INT NOT NULL,
    vendor_id INT REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    deal_id INT REFERENCES public.deals_t(deal_id) ON DELETE SET NULL,
    title VARCHAR(200),
    reward_badge_text VARCHAR(50),
    reward_sub_text VARCHAR(100), -- Secondary sub-note (e.g. "Rs 500 OFF", "Free item")
    voucher_code VARCHAR(100),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) DEFAULT 'Admin',
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(100),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Drop UNIQUE constraint on required_referrals to allow multiple rewards per referral milestone
ALTER TABLE public.referral_reward_tiers_t DROP CONSTRAINT IF EXISTS referral_reward_tiers_t_required_referrals_key;
ALTER TABLE public.referral_reward_tiers_t ADD COLUMN IF NOT EXISTS reward_sub_text VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_referral_reward_tiers_req ON public.referral_reward_tiers_t(required_referrals, is_active);
CREATE INDEX IF NOT EXISTS idx_referral_reward_tiers_vendor ON public.referral_reward_tiers_t(vendor_id);
