CREATE TABLE IF NOT EXISTS public.institutes_t (
    institute_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'System',
    updated_by VARCHAR(255),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);
