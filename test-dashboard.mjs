import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fetchDashboardData } from './lib/dashboard-data.js';

dotenv.config({ path: '.env.local' });

// Mock createServerSupabase so we can run the actual function
global.process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
    console.log('Fetching dashboard data...');
    const start = Date.now();

    try {
        const data = await fetchDashboardData();
        console.log(`Fetched in ${Date.now() - start}ms`);
        console.log(`Total clients: ${data.totalClients}`);
        console.log(`Active jobs: ${data.activeJobs}`);
    } catch (err) {
        console.error('Failed:', err);
    }
}

run();
