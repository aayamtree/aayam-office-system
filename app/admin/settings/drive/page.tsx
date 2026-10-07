'use client';

import GoogleDriveSettings from '@/components/settings/GoogleDriveSettings';
import PiStatusCard from '@/components/drive/PiStatusCard';

const PI_MODE = process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'seafile';

export default function GoogleDrivePage() {
    return (
        <div className="space-y-4 max-w-2xl">
            <div>
                <h1 className="text-page-title text-gray-900">{PI_MODE ? 'Office Cloud (Raspberry Pi)' : 'Google Drive Integration'}</h1>
                <p className="text-gray-500 text-sm mt-1">
                    {PI_MODE
                        ? 'Where your project files are stored, and whether it is online right now'
                        : 'Manage organization-wide Google Drive connection for file uploads'}
                </p>
            </div>

            {PI_MODE ? <PiStatusCard /> : <GoogleDriveSettings />}
        </div>
    );
}
