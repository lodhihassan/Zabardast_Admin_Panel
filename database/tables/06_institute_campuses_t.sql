CREATE TABLE IF NOT EXISTS public.institute_campuses_t (
    campus_id SERIAL PRIMARY KEY,
    institute_id INT NOT NULL REFERENCES public.institutes_t(institute_id) ON DELETE CASCADE,
    campus_name VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    address VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'System',
    updated_by VARCHAR(255),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);
