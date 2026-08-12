CREATE TABLE IF NOT EXISTS public.vendors_t (
    vendor_id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES public.categories_t(category_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    logo_file_id UUID REFERENCES public.uploaded_files_t(file_id) ON DELETE SET NULL,
    banner_file_id UUID REFERENCES public.uploaded_files_t(file_id) ON DELETE SET NULL,
    rating DECIMAL(2,1) DEFAULT 0.0,
    total_reviews INT DEFAULT 0,
    order_by INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'SuperAdmin',
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100),
    updated_date TIMESTAMP WITHOUT TIME ZONE
);
