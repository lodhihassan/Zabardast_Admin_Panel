CREATE TABLE IF NOT EXISTS public.global_notifications_t (
    notification_id UUID DEFAULT gen_random_uuid() NOT NULL,
    notification_type VARCHAR(10) NOT NULL,
    deal_id INT REFERENCES public.deals_t(deal_id) ON DELETE CASCADE,
    vendor_id INT REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT global_notifications_pkey PRIMARY KEY (notification_id)
);
