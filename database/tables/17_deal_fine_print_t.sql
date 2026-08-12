CREATE TABLE IF NOT EXISTS public.deal_fine_print_t (
    fine_print_id SERIAL PRIMARY KEY,
    deal_id INT NOT NULL REFERENCES public.deals_t(deal_id) ON DELETE CASCADE,
    instruction TEXT,
    instruction_text TEXT,
    order_by INT DEFAULT 1,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
