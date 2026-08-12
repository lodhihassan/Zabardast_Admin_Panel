CREATE TABLE IF NOT EXISTS public.student_profiles_t (
    student_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES public.users_t(user_id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    address VARCHAR(200),
    institute_id INT REFERENCES public.institutes_t(institute_id) ON DELETE SET NULL,
    campus_id INT REFERENCES public.institute_campuses_t(campus_id) ON DELETE SET NULL,
    profile_pic_file_id UUID REFERENCES public.uploaded_files_t(file_id) ON DELETE SET NULL,
    referral_code VARCHAR(50) UNIQUE,
    referred_by VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT 'Student',
    updated_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    update_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.student_profiles_t ADD COLUMN IF NOT EXISTS referred_by VARCHAR(50);
ALTER TABLE public.student_profiles_t ADD COLUMN IF NOT EXISTS profile_pic_file_id UUID REFERENCES public.uploaded_files_t(file_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_ref_code ON public.student_profiles_t(referral_code);
CREATE INDEX IF NOT EXISTS idx_student_referred_by ON public.student_profiles_t(referred_by);
