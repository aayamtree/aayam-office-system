/**
 * Script to check dispatch user profiles and diagnose role issues
 * Run with: npx ts-node scripts/check-dispatch-role.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDispatchRoles() {
    console.log('🔍 Checking Dispatch User Profiles...\n');

    // Check all profiles with dispatch role
    const { data: dispatchUsers, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'dispatch');

    if (error) {
        console.error('❌ Error fetching dispatch users:', error);
        return;
    }

    if (!dispatchUsers || dispatchUsers.length === 0) {
        console.log('⚠️  No dispatch users found in database');
        console.log('   This could mean:');
        console.log('   1. No dispatch users have been created yet');
        console.log('   2. Dispatch users exist but their role is not set to "dispatch"');
        console.log('\n   Checking all users with role field issues...\n');

        // Check for users with null or undefined roles
        const { data: allUsers } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, is_active');

        if (allUsers) {
            console.log('📋 All Users:');
            console.table(allUsers);

            const usersWithoutRole = allUsers.filter(u => !u.role);
            if (usersWithoutRole.length > 0) {
                console.log('\n⚠️  Found users without a role set:');
                console.table(usersWithoutRole);
            }
        }
    } else {
        console.log(`✅ Found ${dispatchUsers.length} dispatch user(s):`);
        console.table(dispatchUsers.map(u => ({
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
            id: u.id.substring(0, 8) + '...'
        })));
    }

    console.log('\n✅ Check complete!');
}

checkDispatchRoles()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
