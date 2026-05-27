-- =====================================================
-- EXTERNAL TELEGRAM CONTACTS (Clients, Vendors, etc.)
-- Send notifications to anyone with Telegram
-- =====================================================

-- 1. Add telegram_chat_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- 2. Add telegram_chat_id to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- 3. Create external_telegram_contacts table (for any other contacts)
CREATE TABLE IF NOT EXISTS external_telegram_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contact info
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    company TEXT,
    
    -- Telegram
    telegram_chat_id TEXT NOT NULL,
    telegram_username TEXT,
    
    -- Type/category
    contact_type TEXT DEFAULT 'other', -- 'client', 'vendor', 'supplier', 'transporter', 'other'
    
    -- Related entity (optional)
    related_entity_type TEXT, -- 'client', 'vendor', 'job', etc.
    related_entity_id UUID,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    -- Tracking
    first_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_clients_telegram_chat_id ON clients(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_telegram_chat_id ON vendors(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_telegram_contact_type ON external_telegram_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_external_telegram_is_active ON external_telegram_contacts(is_active);

-- 5. Functions

-- Function to send notification to client via Telegram
CREATE OR REPLACE FUNCTION notify_client_telegram(
    p_client_id UUID,
    p_message TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_chat_id TEXT;
    v_client_name TEXT;
BEGIN
    -- Get client's Telegram chat ID
    SELECT telegram_chat_id, name
    INTO v_chat_id, v_client_name
    FROM clients
    WHERE id = p_client_id
    AND telegram_chat_id IS NOT NULL;
    
    IF v_chat_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Client has no Telegram linked'
        );
    END IF;
    
    -- Return chat ID and message for app to send
    RETURN jsonb_build_object(
        'success', true,
        'chat_id', v_chat_id,
        'message', p_message,
        'client_name', v_client_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get Telegram invitation link for client
CREATE OR REPLACE FUNCTION get_client_telegram_invite_link(p_client_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_bot_username TEXT := 'aayam_notify_bot';
BEGIN
    RETURN format('https://t.me/%s?start=client_%s', v_bot_username, p_client_id);
END;
$$ LANGUAGE plpgsql;

-- Function to link client's Telegram when they message bot
CREATE OR REPLACE FUNCTION link_client_telegram(
    p_client_id UUID,
    p_chat_id TEXT,
    p_username TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE clients
    SET telegram_chat_id = p_chat_id,
        telegram_username = p_username,
        telegram_linked_at = NOW(),
        updated_at = NOW()
    WHERE id = p_client_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for external_telegram_contacts
ALTER TABLE external_telegram_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and finance can view external contacts"
    ON external_telegram_contacts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'finance')
        )
    );

CREATE POLICY "Admin and finance can insert external contacts"
    ON external_telegram_contacts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'finance')
        )
    );

CREATE POLICY "Admin and finance can update external contacts"
    ON external_telegram_contacts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'finance')
        )
    );

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Example 1: Get invitation link for a client
-- SELECT get_client_telegram_invite_link('client-uuid-here');
-- Returns: https://t.me/aayam_notify_bot?start=client_abc123

-- Example 2: Send notification to client (after they've linked)
-- SELECT notify_client_telegram('client-uuid', 'Your order #123 is ready for pickup!');

-- Example 3: Add external contact (supplier, transporter, etc.)
-- INSERT INTO external_telegram_contacts (name, phone, telegram_chat_id, contact_type)
-- VALUES ('Rajesh Transport', '+919876543210', '123456789', 'transporter');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check columns added
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'clients' AND column_name LIKE 'telegram%';

-- Check external contacts table
-- SELECT * FROM external_telegram_contacts LIMIT 5;
