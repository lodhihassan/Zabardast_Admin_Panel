-- ----------------------------------------------------------------
-- SEED DATA: General Parameters for Referral Reward Statuses
-- ----------------------------------------------------------------

DO $$
DECLARE
    v_header_id INT;
BEGIN
    -- 1. Fix/Synchronize PostgreSQL Sequences (prevents duplicate key error if manual IDs were inserted)
    PERFORM setval('public.general_parameter_hd_header_id_seq', (SELECT COALESCE(MAX(header_id), 0) FROM public.general_parameter_hd));
    PERFORM setval('public.general_parameter_dt_detail_id_seq', (SELECT COALESCE(MAX(detail_id), 0) FROM public.general_parameter_dt));

    -- 2. Check if Header already exists
    SELECT header_id INTO v_header_id 
    FROM public.general_parameter_hd 
    WHERE description = 'REFERRAL_REWARD_STATUS';

    -- 3. Insert Header if it does not exist
    IF v_header_id IS NULL THEN
        INSERT INTO public.general_parameter_hd (description, is_active, created_by)
        VALUES ('REFERRAL_REWARD_STATUS', TRUE, 'System')
        RETURNING header_id INTO v_header_id;
    END IF;

    -- 4. Insert Detail Abbreviations if not exist
    IF v_header_id IS NOT NULL THEN
        INSERT INTO public.general_parameter_dt (header_id, detail_name, abbreviation, order_by, is_active, created_by)
        VALUES 
            (v_header_id, 'Ready',    'RDY', 1, TRUE, 'System'),
            (v_header_id, 'Redeemed', 'RDM', 2, TRUE, 'System'),
            (v_header_id, 'Expired',  'EXP', 3, TRUE, 'System'),
            (v_header_id, 'Locked',   'LCK', 4, TRUE, 'System')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
