CREATE TABLE IF NOT EXISTS public.deal_redemptions_t (
    redemption_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.student_profiles_t(user_id) ON DELETE CASCADE,
    deal_id INT NOT NULL REFERENCES public.deals_t(deal_id) ON DELETE CASCADE,
    qr_code_token VARCHAR(255) UNIQUE NOT NULL,
    manual_code VARCHAR(100) NOT NULL,
    status VARCHAR(10) DEFAULT 'P',
    expires_at TIMESTAMPTZ NOT NULL,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_lookup ON public.deal_redemptions_t(qr_code_token, manual_code, status);
