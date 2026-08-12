CREATE TABLE IF NOT EXISTS public.deals_t (
    deal_id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES public.categories_t(category_id) ON DELETE CASCADE,
    vendor_id INT NOT NULL REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    discount_type VARCHAR(50) DEFAULT 'P',
    discount_prefix VARCHAR(50),
    discount_value NUMERIC(10, 2) DEFAULT 0,
    deal_tag VARCHAR(50),
    home_section VARCHAR(50),
    deal_type VARCHAR(50),
    min_purchase_amount NUMERIC(10, 2) DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    valid_day_from VARCHAR(10) DEFAULT '1',
    valid_day_to VARCHAR(10) DEFAULT '7',
    start_time TIME DEFAULT '00:00:00',
    end_time TIME DEFAULT '23:59:00',
    redeem_limit_per_day INT DEFAULT 1,
    description TEXT,
    banner_image_id UUID REFERENCES public.uploaded_files_t(file_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_discount_type ON public.deals_t(discount_type);
CREATE INDEX IF NOT EXISTS idx_deals_deal_tag ON public.deals_t(deal_tag);
CREATE INDEX IF NOT EXISTS idx_deals_home_section ON public.deals_t(home_section);
