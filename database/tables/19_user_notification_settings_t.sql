CREATE TABLE IF NOT EXISTS public.user_notification_settings_t (
    user_id UUID NOT NULL,
    new_offers BOOLEAN DEFAULT TRUE,
    offers_ending_soon BOOLEAN DEFAULT TRUE,
    new_brands BOOLEAN DEFAULT TRUE,
    referral_verified BOOLEAN DEFAULT TRUE,
    milestones BOOLEAN DEFAULT TRUE,
    nearby_deals BOOLEAN DEFAULT FALSE,
    announcements BOOLEAN DEFAULT TRUE,
    updated_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_notification_settings_pkey PRIMARY KEY (user_id),
    CONSTRAINT fk_user_settings FOREIGN KEY (user_id) REFERENCES public.users_t (user_id) ON DELETE CASCADE
);
