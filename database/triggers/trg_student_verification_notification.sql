-- ----------------------------------------------------------------
-- TRIGGER: Student Verification & Rejection Inbox Notification
-- ----------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_student_verification_notification ON public.student_verifications_t;

CREATE TRIGGER trg_student_verification_notification
AFTER INSERT OR UPDATE OF status ON public.student_verifications_t
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_student_verification_notification();
