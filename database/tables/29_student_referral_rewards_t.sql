CREATE TABLE IF NOT EXISTS public.student_referral_rewards_t (
    user_reward_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users_t(user_id) ON DELETE CASCADE,
    tier_id INT NOT NULL REFERENCES public.referral_reward_tiers_t(tier_id) ON DELETE CASCADE,
    status VARCHAR(10) NOT NULL DEFAULT 'RDY', -- 'RDY' (Ready), 'RDM' (Redeemed), 'EXP' (Expired) from general_parameter_dt
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ,
    voucher_code_issued VARCHAR(100),
    created_date TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_referral_reward UNIQUE (user_id, tier_id)
);

CREATE INDEX IF NOT EXISTS idx_student_referral_rewards_user ON public.student_referral_rewards_t(user_id, status);
