-- ----------------------------------------------------------------
-- FUNCTION: Universal Timestamp Auto-Update
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = (NOW() AT TIME ZONE 'Asia/Karachi');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
