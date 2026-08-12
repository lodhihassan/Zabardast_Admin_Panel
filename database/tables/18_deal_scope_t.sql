CREATE TABLE IF NOT EXISTS public.deal_scope_t (
    scope_id SERIAL PRIMARY KEY,
    deal_id INT NOT NULL REFERENCES public.deals_t(deal_id) ON DELETE CASCADE,
    category_id INT REFERENCES public.categories_t(category_id) ON DELETE CASCADE,
    vendor_id INT REFERENCES public.vendors_t(vendor_id) ON DELETE CASCADE,
    product_id INT REFERENCES public.products_t(product_id) ON DELETE CASCADE,
    sub_product_id INT REFERENCES public.sub_products_t(sub_product_id) ON DELETE CASCADE,
    branch_id INT REFERENCES public.branches_t(branch_id) ON DELETE CASCADE,
    institute_id INT REFERENCES public.institutes_t(institute_id) ON DELETE CASCADE,
    scope_type TEXT DEFAULT 'BUY',
    created_by VARCHAR(100) NOT NULL DEFAULT 'Admin',
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100),
    updated_date TIMESTAMP WITHOUT TIME ZONE
);
