CREATE TABLE IF NOT EXISTS public.sub_products_t (
    sub_product_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES public.products_t(product_id) ON DELETE CASCADE,
    vendor_id INT NOT NULL REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    sub_product_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    update_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
