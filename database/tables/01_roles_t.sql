CREATE TABLE IF NOT EXISTS public.roles_t (
    role_id SERIAL PRIMARY KEY,
    role_code VARCHAR(10) NOT NULL UNIQUE, -- 'A' = Admin, 'S' = Student, 'V' = Vendor (Main), 'BV' = Branch Vendor
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
