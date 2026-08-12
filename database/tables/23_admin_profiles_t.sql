CREATE TABLE IF NOT EXISTS public.admin_profiles_t (
    admin_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    role VARCHAR(50) DEFAULT 'Admin',
    profile_image_id UUID REFERENCES public.uploaded_files_t(file_id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
