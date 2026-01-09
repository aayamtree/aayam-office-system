-- Add attachment columns
ALTER TABLE vendor_payments ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS attachment_url text;

-- Ensure Storage Bucket exists (basic attempt, though usually requires UI/API)
-- We'll assume bucket 'documents' or 'payment-proofs' exists or we use a public one.
-- For now, relying on Supabase Dashboard for bucket creation is standard, but we can try to insert into storage.buckets if permissions allow.
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Public Read, Auth Write)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'payment-proofs' );
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'payment-proofs' );
