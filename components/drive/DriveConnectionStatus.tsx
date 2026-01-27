'use client';

import { useSession, signIn } from 'next-auth/react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { checkDriveConnection } from '@/lib/google-drive-upload';

export default function DriveConnectionStatus() {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                <span className="text-xs text-gray-600">Checking Drive...</span>
            </div>
        );
    }

    const driveStatus = checkDriveConnection(session);

    // Not connected or missing scope - show connect button
    if (!driveStatus.connected || !driveStatus.hasDriveScope) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <XCircle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-900">Drive: Disconnected</span>
                <button
                    onClick={() => signIn('google', { callbackUrl: window.location.href })}
                    className="ml-auto px-3 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 transition-colors"
                >
                    Connect
                </button>
            </div>
        );
    }

    // Connected - show status only
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-900">Drive: Connected</span>
        </div>
    );
}
