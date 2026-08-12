CREATE TABLE IF NOT EXISTS public.users_t (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    role_id INT REFERENCES public.roles_t(role_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
