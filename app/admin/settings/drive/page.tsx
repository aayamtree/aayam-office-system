'use client';

import GoogleDriveSettings from '@/components/settings/GoogleDriveSettings';

export default function GoogleDrivePage() {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h1 className="text-page-title text-gray-900">Google Drive Integration</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Manage organization-wide Google Drive connection for file uploads
                </p>
            </div>

            <GoogleDriveSettings />
        </div>
    );
}
