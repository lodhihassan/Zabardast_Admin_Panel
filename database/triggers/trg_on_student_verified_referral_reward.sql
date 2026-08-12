-- ----------------------------------------------------------------
-- TRIGGER: Student Verification Referral Reward Evaluation
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_on_student_verified_referral_reward ON public.student_profiles_t;

CREATE TRIGGER trg_on_student_verified_referral_reward
AFTER UPDATE OF is_verified ON public.student_profiles_t
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_student_verified_referral_reward();
