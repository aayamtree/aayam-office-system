-- Add brand_name column to clients table for searchable brand tracking
-- Supports hashtag format: #tiger #cobra

-- Add brand_name column
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- Add full-text search index for performance
CREATE INDEX IF NOT EXISTS idx_clients_brand_name 
ON clients USING gin(to_tsvector('english', brand_name));

-- Add regular index for exact matches
CREATE INDEX IF NOT EXISTS idx_clients_brand_name_text 
ON clients(brand_name);

-- Add comment
COMMENT ON COLUMN clients.brand_name IS 'Brand names for client (hashtag format supported: #tiger #cobra). Searchable across system.';

-- Example usage:
-- UPDATE clients SET brand_name = '#tiger #premium' WHERE name = 'ABC Corp';
-- SELECT * FROM clients WHERE to_tsvector('english', brand_name) @@ to_tsquery('english', 'tiger');
