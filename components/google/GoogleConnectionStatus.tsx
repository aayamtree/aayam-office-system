'use client';

import { useSession, signIn } from 'next-auth/react';
import { CheckCircle, XCircle, Loader2, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ConnectionStatus {
    connected: boolean;
    hasCalendarScope: boolean;
    hasDriveScope: boolean;
}

function checkGoogleConnection(session: any): ConnectionStatus {
    const connected = !!session?.accessToken;
    const scopes = session?.scope || '';

    return {
        connected,
        hasCalendarScope: scopes.includes('calendar.events'),
        hasDriveScope: scopes.includes('drive.file')
    };
}

export default function GoogleConnectionStatus() {
    const { data: session, status } = useSession();
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    if (status === 'loading') {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                <span className="text-xs text-gray-600">Checking...</span>
            </div>
        );
    }

    const googleStatus = checkGoogleConnection(session);

    // Not connected at all
    if (!googleStatus.connected) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md">
                <XCircle className="w-4 h-4 text-gray-600" />
                <span className="text-label text-gray-900">Google: Disconnected</span>
                {isAdmin ? (
                    <button
                        onClick={() => signIn('google', { callbackUrl: window.location.href })}
                        className="ml-auto px-3 py-1 bg-gray-900 hover:bg-gray-800 text-white text-label rounded-md transition-colors flex items-center gap-1"
                    >
                        <Shield className="w-3 h-3" />
                        Connect
                    </button>
                ) : (
                    <span className="ml-auto text-xs text-gray-700 italic">
                        Contact admin to connect
                    </span>
                )}
            </div>
        );
    }

    // Partially connected - missing one or both scopes
    if (!googleStatus.hasCalendarScope || !googleStatus.hasDriveScope) {
        const missing = [];
        if (!googleStatus.hasCalendarScope) missing.push('Calendar');
        if (!googleStatus.hasDriveScope) missing.push('Drive');

        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md">
                <XCircle className="w-4 h-4 text-gray-600" />
                <span className="text-label text-gray-900">
                    {missing.join(' & ')}: Disconnected
                </span>
                {isAdmin ? (
                    <button
                        onClick={() => signIn('google', { callbackUrl: window.location.href })}
                        className="ml-auto px-3 py-1 bg-gray-900 hover:bg-gray-800 text-white text-label rounded-md transition-colors flex items-center gap-1"
                    >
                        <Shield className="w-3 h-3" />
                        Reconnect
                    </button>
                ) : (
                    <span className="ml-auto text-xs text-gray-700 italic">
                        Contact admin to reconnect
                    </span>
                )}
            </div>
        );
    }

    // Fully connected - show both services
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md">
            <CheckCircle className="w-4 h-4 text-gray-600" />
            <div className="flex items-center gap-1.5 text-label text-gray-900">
                <span>Google:</span>
                <span className="opacity-75">Cal</span>
                <span className="opacity-75">Drive</span>
            </div>
        </div>
    );
}
