CREATE TABLE IF NOT EXISTS public.user_read_global_notifications_t (
    user_id UUID NOT NULL REFERENCES public.users_t(user_id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES public.global_notifications_t(notification_id) ON DELETE CASCADE,
    read_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);
