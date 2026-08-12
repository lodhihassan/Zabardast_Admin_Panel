-- ----------------------------------------------------------------
-- TRIGGER: Supabase Auth User Creation Handler Binding
-- ----------------------------------------------------------------
-- Binds fn_handle_auth_user_signup() to auth.users table on INSERT.

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_auth_user_signup();
