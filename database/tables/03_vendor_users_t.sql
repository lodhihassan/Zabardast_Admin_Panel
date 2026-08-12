CREATE TABLE IF NOT EXISTS public.vendor_users_t (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id INT NOT NULL REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    branch_id INT REFERENCES public.branches_t(branch_id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    vendor_role VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(100),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_users_vendor ON public.vendor_users_t(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_users_branch ON public.vendor_users_t(branch_id);
