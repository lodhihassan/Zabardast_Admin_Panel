
CREATE TABLE IF NOT EXISTS public.uploaded_files_t (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path VARCHAR(500) NOT NULL UNIQUE,
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    uploaded_by UUID,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
