import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role key
// ONLY use this in Server Components and API routes — never in client code
export function createServerSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
