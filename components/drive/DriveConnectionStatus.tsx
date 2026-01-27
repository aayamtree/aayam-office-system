'use client';

import { useSession, signIn } from 'next-auth/react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { checkDriveConnection } from '@/lib/google-drive-upload';

export default function DriveConnectionStatus() {
    const { data: session, status } = useSession();

    if (status === 'loading') return null;

    const driveStatus = checkDriveConnection(session);

    if (!driveStatus.connected) {
        return (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-amber-900">Google Drive Not Connected</h3>
                        <p className="text-sm text-amber-700 mt-1">Sign in with Google to enable file uploads</p>
                    </div>
                    <button
                        onClick={() => signIn('google')}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Connect Drive
                    </button>
                </div>
            </div>
        );
    }

    if (!driveStatus.hasDriveScope) {
        return (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-amber-900">Drive Upload Permission Required</h3>
                        <p className="text-sm text-amber-700 mt-1">
                            Reconnect to grant Drive upload permission
                        </p>
                    </div>
                    <button
                        onClick={() => signIn('google', { callbackUrl: window.location.href })}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reconnect
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">Google Drive Connected</span>
            </div>
        </div>
    );
}
