-- ================================================================
-- FUNCTION: fn_handle_auth_user_signup
-- Trigger: Fires AFTER INSERT on auth.users
-- ================================================================
-- Role -> Table Mapping:
--   A  (Admin)          -> users_t + admin_profiles_t
--   S  (Student)        -> users_t + student_profiles_t + user_notifications_t
--   V  (Vendor)         -> users_t ONLY  (vendor_users_t inserted by catalog.js)
--   BV (Branch Vendor)  -> users_t ONLY  (vendor_users_t inserted by catalog.js)
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_handle_auth_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_role_code         VARCHAR(10);
    v_role_id           INT;
    v_base_name         TEXT;
    v_ref_code          TEXT;
    v_exists            BOOLEAN;
    v_referrer_user_id  UUID;
    v_student_name      TEXT;
    v_used_ref_code     TEXT;
BEGIN
    -- STEP 1: Read role_code from signup metadata
    v_role_code := NEW.raw_user_meta_data->>'role_code';

    -- Default to 'S' (Student) if role_code not provided
    IF v_role_code IS NULL OR v_role_code = '' THEN
        v_role_code := 'S';
    END IF;

    -- STEP 2: Resolve role_id from roles_t
    SELECT role_id INTO v_role_id
    FROM public.roles_t
    WHERE role_code = v_role_code;

    -- Fallback to Student role_id if role code not found in roles_t
    IF v_role_id IS NULL THEN
        SELECT role_id INTO v_role_id FROM public.roles_t WHERE role_code = 'S';
    END IF;

    -- STEP 3: Always insert base record into users_t
    INSERT INTO public.users_t (user_id, email, role_id)
    VALUES (NEW.id, NEW.email, v_role_id)
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email, role_id = EXCLUDED.role_id;

    -- ================================================================
    -- STEP 4: Role-specific profile inserts
    -- ================================================================

    IF v_role_code = 'S' THEN
        -- STUDENT: Insert student profile + send notifications
        v_student_name  := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Student');
        v_base_name     := UPPER(REGEXP_REPLACE(v_student_name, '\s+', '', 'g'));
        v_used_ref_code := NEW.raw_user_meta_data->>'referred_by';

        -- Generate unique referral code for this student
        LOOP
            v_ref_code := v_base_name || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
            SELECT EXISTS(
                SELECT 1 FROM public.student_profiles_t WHERE referral_code = v_ref_code
            ) INTO v_exists;
            EXIT WHEN NOT v_exists;
        END LOOP;

        -- Insert into student_profiles_t
        INSERT INTO public.student_profiles_t (
            user_id, full_name, phone_number, created_by, referral_code, referred_by
        )
        VALUES (
            NEW.id,
            v_student_name,
            NEW.raw_user_meta_data->>'phone_number',
            'Student',
            v_ref_code,
            v_used_ref_code
        )
        ON CONFLICT (user_id) DO NOTHING;

        -- Welcome Notification for new student
        INSERT INTO public.user_notifications_t (
            user_id, notification_type, title, body, is_read, created_date
        ) VALUES (
            NEW.id,
            'W',
            'Welcome to Zabardast!',
            'Glad to have you onboard! Upload your student ID card to unlock exclusive student discounts across all partner brands.',
            FALSE,
            (NOW() AT TIME ZONE 'Asia/Karachi')
        );

        -- Referral Joined Notification for referrer (if applicable)
        IF v_used_ref_code IS NOT NULL AND v_used_ref_code <> '' THEN
            SELECT user_id INTO v_referrer_user_id
            FROM public.student_profiles_t
            WHERE referral_code = v_used_ref_code;

            IF v_referrer_user_id IS NOT NULL THEN
                INSERT INTO public.user_notifications_t (
                    user_id, notification_type, title, body, is_read, created_date
                ) VALUES (
                    v_referrer_user_id,
                    'RJ',
                    'Someone joined using your link!',
                    v_student_name || ' just signed up using your referral code. Once their student status is verified, you both unlock rewards!',
                    FALSE,
                    (NOW() AT TIME ZONE 'Asia/Karachi')
                );
            END IF;
        END IF;

    ELSIF v_role_code IN ('V', 'BV') THEN
        -- VENDOR / BRANCH VENDOR:
        -- users_t inserted above (Step 3).
        -- vendor_users_t is inserted separately by catalog.js AFTER signUp.
        -- Nothing extra to do here.
        NULL;

    ELSIF v_role_code = 'A' THEN
        -- ADMIN: Insert into admin_profiles_t directly (no information_schema check needed)
        BEGIN
            INSERT INTO public.admin_profiles_t (user_id, full_name, phone_number)
            VALUES (
                NEW.id,
                COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Admin'),
                NEW.raw_user_meta_data->>'phone_number'
            )
            ON CONFLICT (user_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            -- admin_profiles_t may not exist yet; silently continue
            NULL;
        END;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
