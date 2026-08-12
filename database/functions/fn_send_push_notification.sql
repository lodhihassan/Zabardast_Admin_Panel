-- =================================================================
-- FUNCTION & TRIGGERS: Send Real-Time FCM Push Notifications & Audit Log
-- =================================================================

-- 1. Create Audit Log Table
CREATE TABLE IF NOT EXISTS public.push_notification_logs_t (
    log_id            UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id           UUID, -- NULL = Broadcast to all
    notification_type VARCHAR(20) NOT NULL,
    title             VARCHAR(255) NOT NULL,
    body              TEXT NOT NULL,
    status            VARCHAR(20) DEFAULT 'SENT',
    created_date      TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT push_notification_logs_pkey PRIMARY KEY (log_id)
);

GRANT ALL ON TABLE public.push_notification_logs_t TO anon, authenticated, service_role;

-- 2. Main Function to Invoke Supabase Edge Function & Record Audit Log
CREATE OR REPLACE FUNCTION public.fn_send_push_notification(
    p_user_id        UUID,       -- NULL = broadcast to all users
    p_title          TEXT,
    p_body           TEXT,
    p_type           TEXT DEFAULT 'SYS'
)
RETURNS VOID AS $$
DECLARE
    v_payload JSONB;
BEGIN
    -- Build payload
    v_payload := jsonb_build_object(
        'title',             p_title,
        'body',              p_body,
        'notification_type', COALESCE(p_type, 'SYS')
    );

    -- Add user_id only if targeting a specific user (NULL = broadcast)
    IF p_user_id IS NOT NULL THEN
        v_payload := v_payload || jsonb_build_object('user_id', p_user_id::TEXT);
    END IF;

    -- Call Supabase Edge Function via pg_net (Supabase HTTP extension)
    PERFORM net.http_post(
        url     := 'https://ypxbpwufoioxnvixwmqq.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer sb_publishable_lLB4-6dkBBrNIdLUS89urQ_HhL_SrXs'
        ),
        body    := v_payload
    );

    -- Record in Audit Log Table
    INSERT INTO public.push_notification_logs_t (
        user_id,
        notification_type,
        title,
        body,
        status
    ) VALUES (
        p_user_id,
        COALESCE(p_type, 'SYS'),
        p_title,
        p_body,
        'SENT'
    );

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO public.push_notification_logs_t (
            user_id,
            notification_type,
            title,
            body,
            status
        ) VALUES (
            p_user_id,
            COALESCE(p_type, 'SYS'),
            p_title,
            p_body,
            'FAILED'
        );
        RAISE WARNING 'fn_send_push_notification failed for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger Function for Personal User Notifications
CREATE OR REPLACE FUNCTION public.trg_fn_send_user_push_notification()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.fn_send_push_notification(
        NEW.user_id,
        NEW.title,
        NEW.body,
        NEW.notification_type
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_push_notification ON public.user_notifications_t;
CREATE TRIGGER trg_user_push_notification
    AFTER INSERT ON public.user_notifications_t
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_send_user_push_notification();

-- 4. Trigger Function for Global Broadcast Notifications
CREATE OR REPLACE FUNCTION public.trg_fn_send_global_push_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        PERFORM public.fn_send_push_notification(
            NULL, -- NULL means broadcast to all active FCM tokens
            NEW.title,
            NEW.body,
            NEW.notification_type
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_global_push_notification ON public.global_notifications_t;
CREATE TRIGGER trg_global_push_notification
    AFTER INSERT ON public.global_notifications_t
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_send_global_push_notification();
