-- ----------------------------------------------------------------
-- FUNCTION: Student Verification & Rejection Personal Notifications
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_handle_student_verification_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_type VARCHAR(10);
    v_title VARCHAR(255);
    v_body TEXT;
BEGIN
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status)) THEN

        -- CASE A: Student Verified / Approved ('A')
        IF NEW.status = 'A' THEN
            v_type  := 'V'; -- Verified (general_parameter_dt detail_id 31)
            v_title := 'You''re verified';
            v_body  := 'Your student status is confirmed. Every partner discount is now unlocked. Tap to see.';

            INSERT INTO public.user_notifications_t (
                user_id,
                notification_type,
                title,
                body,
                is_read,
                created_date
            ) VALUES (
                NEW.user_id,
                v_type,
                v_title,
                v_body,
                FALSE,
                (NOW() AT TIME ZONE 'Asia/Karachi')
            );

        -- CASE B: Student Verification Rejected ('R')
        ELSIF NEW.status = 'R' THEN
            v_type  := 'R'; -- Reject (general_parameter_dt detail_id 39)
            v_title := 'Verification Status Update';
            v_body  := 'Your student verification request was rejected. Please re-upload valid student documents to try again.';

            INSERT INTO public.user_notifications_t (
                user_id,
                notification_type,
                title,
                body,
                is_read,
                created_date
            ) VALUES (
                NEW.user_id,
                v_type,
                v_title,
                v_body,
                FALSE,
                (NOW() AT TIME ZONE 'Asia/Karachi')
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
