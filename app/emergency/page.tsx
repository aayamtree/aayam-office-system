'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmergencyLogin() {
    const router = useRouter();

    useEffect(() => {
        // Force set the fallback profile
        const fakeProfile = {
            id: 'emergency-admin',
            email: 'admin@aayam.com',
            full_name: 'Emergency Admin',
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString()
        };

        localStorage.setItem('aayam_fallback_profile', JSON.stringify(fakeProfile));
        console.log('Emergency Profile Set. Redirecting...');

        setTimeout(() => {
            window.location.href = '/admin/dashboard';
        }, 1000);
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
            <div className="text-center p-8 bg-white rounded-xl shadow-xl">
                <h1 className="text-page-title text-red-600 mb-4">Emergency Access Mode</h1>
                <p className="text-gray-600 mb-4">Injecting admin session...</p>
                <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
        </div>
    );
}
