CREATE TABLE IF NOT EXISTS public.products_t (
    product_id SERIAL PRIMARY KEY,
    vendor_id INT NOT NULL REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    image_file_id UUID REFERENCES public.uploaded_files_t(file_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    update_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
