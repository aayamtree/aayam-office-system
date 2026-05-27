-- =====================================================
-- DUAL NOTIFICATION SYSTEM (Telegram + In-App)
-- Created: 2026-05-26
-- =====================================================

-- 1. Notifications table (for in-app notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Notification content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'job_assigned', 'qc_ready', 'payment_received', 'followup_reminder', etc.
    priority TEXT DEFAULT 'normal', -- 'normal', 'high', 'urgent'
    
    -- Related entity (optional)
    entity_type TEXT, -- 'job', 'payment', 'lead', 'invoice', etc.
    entity_id TEXT,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Delivery tracking
    sent_to_telegram BOOLEAN DEFAULT FALSE,
    telegram_message_id TEXT,
    telegram_sent_at TIMESTAMPTZ,
    
    -- Metadata
    action_url TEXT, -- Deep link to relevant page
    icon TEXT, -- Emoji or icon name
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Telegram mapping (store users' Telegram chat IDs)
CREATE TABLE IF NOT EXISTS user_telegram (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    telegram_chat_id TEXT NOT NULL,
    telegram_username TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_telegram_user_id ON user_telegram(user_id);
CREATE INDEX IF NOT EXISTS idx_user_telegram_chat_id ON user_telegram(telegram_chat_id);

-- 4. Row Level Security (RLS)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_telegram ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can mark their notifications as read
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Users can view/update their own Telegram mapping
CREATE POLICY "Users can view own Telegram mapping"
    ON user_telegram FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own Telegram mapping"
    ON user_telegram FOR ALL
    USING (auth.uid() = user_id);

-- 5. Functions

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = p_user_id
        AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET is_read = TRUE,
        read_at = NOW(),
        updated_at = NOW()
    WHERE id = p_notification_id
    AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE notifications
    SET is_read = TRUE,
        read_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND is_read = FALSE;
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_telegram_updated_at
    BEFORE UPDATE ON user_telegram
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check tables created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('notifications', 'user_telegram');

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('notifications', 'user_telegram');

-- Check RLS policies
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('notifications', 'user_telegram');
