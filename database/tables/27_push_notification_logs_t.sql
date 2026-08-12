-- =================================================================
-- TABLE: Push Notification Audit Logs
-- =================================================================
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
