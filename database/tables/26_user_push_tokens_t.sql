-- ----------------------------------------------------------------
-- TABLE: User FCM Push Notification Tokens
-- Stores Firebase Cloud Messaging tokens per user device
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_push_tokens_t (
    token_id     UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id      UUID NOT NULL,
    fcm_token    TEXT NOT NULL,
    device_type  VARCHAR(20) DEFAULT 'android', -- 'android' | 'ios'
    is_active    BOOLEAN DEFAULT TRUE,
    created_date TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Karachi'),
    updated_date TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Karachi'),

    CONSTRAINT user_push_tokens_pkey PRIMARY KEY (token_id),
    CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token),
    CONSTRAINT fk_push_token_user FOREIGN KEY (user_id)
        REFERENCES public.users_t (user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
    ON public.user_push_tokens_t (user_id)
    WHERE is_active = TRUE;
