CREATE TABLE IF NOT EXISTS public.redemption_logs_history_t (
    log_id SERIAL PRIMARY KEY,
    redemption_id INT REFERENCES public.deal_redemptions_t(redemption_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.student_profiles_t(user_id) ON DELETE CASCADE,
    deal_id INT NOT NULL REFERENCES public.deals_t(deal_id) ON DELETE CASCADE,
    vendor_id INT REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    branch_id INT REFERENCES public.branches_t(branch_id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES public.vendor_users_t(user_id) ON DELETE SET NULL,
    total_bill_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    savings_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_limit_check ON public.redemption_logs_history_t(user_id, deal_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_history_branch_date ON public.redemption_logs_history_t(branch_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_cashier ON public.redemption_logs_history_t(cashier_id);
