CREATE TABLE IF NOT EXISTS public.general_parameter_dt (
    detail_id SERIAL PRIMARY KEY,
    header_id INT NOT NULL REFERENCES public.general_parameter_hd(header_id) ON DELETE CASCADE,
    detail_name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50) NOT NULL,
    order_by INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gpd_abbreviation ON public.general_parameter_dt(abbreviation);
