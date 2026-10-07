'use client';

import PiStatusCard from '@/components/drive/PiStatusCard';

// Office Cloud (Raspberry Pi) is the only file store. No Google sign-in here.
export default function OfficeCloudPage() {
    return (
        <div className="space-y-4 max-w-2xl">
            <div>
                <h1 className="text-page-title text-gray-900">Office Cloud (Raspberry Pi)</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Where your project files are stored, and whether it is online right now
                </p>
            </div>
            <PiStatusCard />
        </div>
    );
}
