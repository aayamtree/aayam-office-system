-- Performance indexes for search and common query patterns
-- Run with: supabase db push  OR  apply via Supabase dashboard SQL editor

-- Enable trigram extension for fast ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Clients: fast ILIKE search on name and company
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_name_trgm
  ON clients USING GIN (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_company_trgm
  ON clients USING GIN (company gin_trgm_ops);

-- Bank transactions: fast lookup by client (for CRM payment totals)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_transactions_client_id
  ON bank_transactions (client_id)
  WHERE client_id IS NOT NULL;

-- Cash transactions: fast lookup by client
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_transactions_client_id
  ON cash_transactions (client_id)
  WHERE client_id IS NOT NULL;

-- Bank transactions: fast lookup by account + date (for statement page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_transactions_account_date
  ON bank_transactions (bank_account_id, transaction_date DESC);

-- Cash transactions: fast lookup by account + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_transactions_account_date
  ON cash_transactions (cash_account_id, transaction_date DESC);

-- Quotations: fast lookup by quote_number for fallback sequence
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotations_quote_number
  ON quotations (quote_number);

-- Designer attendance: fast date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designer_attendance_date
  ON designer_attendance (date, designer_id);

-- Notifications: fast lookup per user (queried on every page load via NotificationBell)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read)
  WHERE is_read = false;
