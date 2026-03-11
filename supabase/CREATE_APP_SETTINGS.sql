-- Supabase: Create app_settings table for storing app-wide key/value settings
-- Run this once in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: admins can read and write
CREATE POLICY "admins_can_manage_app_settings"
    ON public.app_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: all authenticated users can read (needed for usePairdropUrl hook on the Files page)
CREATE POLICY "authenticated_users_can_read_app_settings"
    ON public.app_settings
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Seed the pairdrop_url key with an empty value (so upsert works correctly on first save)
INSERT INTO public.app_settings (key, value)
VALUES ('pairdrop_url', '')
ON CONFLICT (key) DO NOTHING;
