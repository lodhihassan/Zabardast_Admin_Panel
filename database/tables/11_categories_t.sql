CREATE TABLE IF NOT EXISTS public.categories_t (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    image_file_id UUID REFERENCES public.uploaded_files_t(file_id) ON DELETE SET NULL,
    order_by INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'SuperAdmin',
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100),
    updated_date TIMESTAMP WITHOUT TIME ZONE
);
