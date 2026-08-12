CREATE TABLE IF NOT EXISTS public.branches_t (
    branch_id SERIAL PRIMARY KEY,
    vendor_id INT NOT NULL REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    branch_name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    address TEXT,
    order_by INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'SuperAdmin',
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100),
    updated_date TIMESTAMP WITHOUT TIME ZONE
);
