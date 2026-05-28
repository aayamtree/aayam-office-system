-- =====================================================
-- STAFF TELEGRAM LINKING (Phase 1)
-- Allow staff members to link their Telegram accounts
-- =====================================================

-- 1. Add Telegram columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- 2. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- 3. Function to generate staff linking token
CREATE OR REPLACE FUNCTION generate_staff_telegram_link(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_bot_username TEXT := 'aayam_notify_bot';
BEGIN
    RETURN format('https://t.me/%s?start=staff_%s', v_bot_username, p_profile_id);
END;
$$ LANGUAGE plpgsql;

-- 4. Function to link staff Telegram when they start the bot
CREATE OR REPLACE FUNCTION link_staff_telegram(
    p_profile_id UUID,
    p_chat_id TEXT,
    p_username TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
BEGIN
    -- Get profile info
    SELECT id, full_name, role INTO v_profile
    FROM profiles
    WHERE id = p_profile_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found'
        );
    END IF;
    
    -- Check if chat_id already linked to another profile
    IF EXISTS (
        SELECT 1 FROM profiles 
        WHERE telegram_chat_id = p_chat_id 
        AND id != p_profile_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This Telegram account is already linked to another staff member'
        );
    END IF;
    
    -- Update profile with Telegram info
    UPDATE profiles
    SET telegram_chat_id = p_chat_id,
        telegram_username = p_username,
        telegram_linked_at = NOW(),
        updated_at = NOW()
    WHERE id = p_profile_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'profile_name', v_profile.full_name,
        'profile_role', v_profile.role,
        'message', format('✅ Linked! You are now connected as %s (%s)', v_profile.full_name, v_profile.role)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to unlink staff Telegram
CREATE OR REPLACE FUNCTION unlink_staff_telegram(p_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE profiles
    SET telegram_chat_id = NULL,
        telegram_username = NULL,
        telegram_linked_at = NULL,
        updated_at = NOW()
    WHERE id = p_profile_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to check if staff has Telegram linked
CREATE OR REPLACE FUNCTION staff_has_telegram(p_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = p_profile_id
        AND telegram_chat_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

-- 7. View: Staff members without Telegram (for admin monitoring)
CREATE OR REPLACE VIEW staff_telegram_status AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.telegram_chat_id,
    p.telegram_username,
    p.telegram_linked_at,
    CASE 
        WHEN p.telegram_chat_id IS NOT NULL THEN 'linked'
        ELSE 'not_linked'
    END as link_status,
    p.is_active
FROM profiles p
WHERE p.role IN ('designer', 'cmyk', 'dispatch', 'admin', 'finance', 'marketing')
ORDER BY 
    CASE WHEN p.telegram_chat_id IS NULL THEN 0 ELSE 1 END,
    p.full_name;

-- 8. Function to get staff by Telegram chat_id (for bot webhook)
CREATE OR REPLACE FUNCTION get_profile_by_telegram_chat_id(p_chat_id TEXT)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.email,
        p.role,
        p.is_active
    FROM profiles p
    WHERE p.telegram_chat_id = p_chat_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Generate Telegram link for a staff member
-- SELECT generate_staff_telegram_link('profile-uuid-here');
-- Returns: https://t.me/aayam_notify_bot?start=staff_abc123...

-- Link staff when they message the bot
-- SELECT link_staff_telegram('profile-uuid', '123456789', '@username');

-- Check link status
-- SELECT staff_has_telegram('profile-uuid');

-- View all staff Telegram status
-- SELECT * FROM staff_telegram_status;

-- Unlink staff
-- SELECT unlink_staff_telegram('profile-uuid');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check columns added
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- AND column_name LIKE 'telegram%';

-- Check functions created
-- SELECT proname FROM pg_proc WHERE proname LIKE '%telegram%';
