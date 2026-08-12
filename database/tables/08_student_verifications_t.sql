CREATE TABLE IF NOT EXISTS public.student_verifications_t (
    verification_id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    student_card_file_id UUID NOT NULL,
    cnic_card_file_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'P', -- P = Pending, A = Approved, R = Rejected
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100),
    update_date TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT student_verifications_t_pkey PRIMARY KEY (verification_id),
    CONSTRAINT unique_user_verification UNIQUE (user_id),
    CONSTRAINT fk_verification_cnic_card FOREIGN KEY (cnic_card_file_id) REFERENCES public.uploaded_files_t(file_id),
    CONSTRAINT fk_verification_student_card FOREIGN KEY (student_card_file_id) REFERENCES public.uploaded_files_t(file_id),
    CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES public.users_t(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_verif_status ON public.student_verifications_t(status);
