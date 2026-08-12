CREATE TABLE IF NOT EXISTS public.general_parameter_hd (
    header_id SERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
