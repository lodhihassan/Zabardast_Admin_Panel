CREATE TABLE IF NOT EXISTS public.user_notifications_t (
    notification_id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    notification_type VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_notifications_pkey PRIMARY KEY (notification_id),
    CONSTRAINT fk_user_notifications FOREIGN KEY (user_id) REFERENCES public.users_t (user_id) ON DELETE CASCADE
);
