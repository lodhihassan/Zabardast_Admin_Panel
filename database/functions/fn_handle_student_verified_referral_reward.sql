CREATE OR REPLACE FUNCTION public.fn_handle_student_verified_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
    v_referrer_user_id UUID;
    v_student_name TEXT;
BEGIN
    -- Check if student just became verified
    IF (TG_OP = 'UPDATE') AND (OLD.is_verified IS DISTINCT FROM NEW.is_verified) AND (NEW.is_verified = TRUE) THEN
        IF NEW.referred_by IS NOT NULL AND NEW.referred_by <> '' THEN
            -- Find referrer user_id
            SELECT user_id INTO v_referrer_user_id
            FROM public.student_profiles_t
            WHERE referral_code = NEW.referred_by;

            IF v_referrer_user_id IS NOT NULL THEN
                v_student_name := COALESCE(NEW.full_name, 'Your friend');

                -- Send Referral Verified Notification ('RV')
                INSERT INTO public.user_notifications_t (
                    user_id, notification_type, title, body, is_read, created_date
                ) VALUES (
                    v_referrer_user_id,
                    'RV',
                    'Referral Verified!',
                    v_student_name || ' just got verified as a student! You are one step closer to your next reward.',
                    FALSE,
                    (NOW() AT TIME ZONE 'Asia/Karachi')
                );

                -- Evaluate and grant unlocked rewards
                PERFORM public.fn_evaluate_student_referral_rewards(v_referrer_user_id);
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
