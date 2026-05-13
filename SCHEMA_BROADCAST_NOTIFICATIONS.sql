-- Broadcast Notification System
-- Allows admin/finance to send instant popup messages to all users or specific roles

-- Create broadcast_notifications table
CREATE TABLE IF NOT EXISTS broadcast_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    target_audience TEXT DEFAULT 'all', -- 'all', 'admin', 'finance', 'designer', 'marketing', 'dispatch', 'cmyk'
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional: auto-hide after this time
);

-- Create dismissals tracking table
CREATE TABLE IF NOT EXISTS notification_dismissals (
    notification_id UUID REFERENCES broadcast_notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE broadcast_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_dismissals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_notifications

-- Only admin/finance can create broadcasts
CREATE POLICY "Admin and finance can create broadcasts"
    ON broadcast_notifications FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'finance')
        )
    );

-- Users can view notifications targeted at them
CREATE POLICY "Users can view their notifications"
    ON broadcast_notifications FOR SELECT
    TO authenticated
    USING (
        target_audience = 'all' 
        OR target_audience = (
            SELECT role FROM profiles WHERE id = auth.uid()
        )
        OR (expires_at IS NULL OR expires_at > NOW())
    );

-- Admin/finance can view all
CREATE POLICY "Admin can view all broadcasts"
    ON broadcast_notifications FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'finance')
        )
    );

-- RLS Policies for notification_dismissals

-- Users can insert their own dismissals
CREATE POLICY "Users can dismiss notifications"
    ON notification_dismissals FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can view their own dismissals
CREATE POLICY "Users can view their dismissals"
    ON notification_dismissals FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_broadcast_created_at ON broadcast_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_target ON broadcast_notifications(target_audience);
CREATE INDEX IF NOT EXISTS idx_dismissals_user ON notification_dismissals(user_id);

-- Enable Realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_notifications;

-- Comments
COMMENT ON TABLE broadcast_notifications IS 'Admin broadcast messages shown as popups to users';
COMMENT ON TABLE notification_dismissals IS 'Tracks which users dismissed which notifications';
