'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Cloud, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function GoogleDriveSettings() {
    const { profile } = useAuth();
    const { data: session } = useSession();
    const [driveStatus, setDriveStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // Load current Drive status
    const loadStatus = async () => {
        try {
            const res = await fetch('/api/drive/connect');
            const data = await res.json();
            setDriveStatus(data);
        } catch (error) {
            console.error('Error loading Drive status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    // Handle Google Drive connection
    const handleConnect = async () => {
        console.log('Starting Google Drive connection...');

        // Store in localStorage so it persists after OAuth redirect
        localStorage.setItem('gdrive_connecting', 'true');
        setConnecting(true);

        // Authenticate with Google
        const result = await signIn('google', {
            callbackUrl: window.location.href,
            redirect: false
        });

        console.log('SignIn result:', result);
    };

    // Check localStorage on mount to see if we're returning from OAuth
    useEffect(() => {
        const isConnecting = localStorage.getItem('gdrive_connecting') === 'true';
        if (isConnecting) {
            console.log('Detected returning from OAuth, setting connecting=true');
            setConnecting(true);
        }
    }, []);

    // After Google OAuth, save credentials to database
    useEffect(() => {
        console.log('Session changed:', {
            hasAccessToken: !!session?.accessToken,
            connecting,
            session
        });

        if (session?.accessToken && connecting) {
            console.log('Triggering saveCredentials...');
            // Clear the localStorage flag
            localStorage.removeItem('gdrive_connecting');
            saveCredentials();
        }
    }, [session, connecting]);

    const saveCredentials = async () => {
        try {
            if (!profile?.id) {
                alert('User not authenticated. Please refresh and try again.');
                return;
            }

            console.log('Attempting to save credentials...', {
                userId: profile.id,
                hasAccessToken: !!session?.accessToken,
                hasRefreshToken: !!session?.refreshToken,
                scopes: session?.scope
            });

            const res = await fetch('/api/drive/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: profile.id,  // Send user ID from auth context
                    accessToken: session?.accessToken,
                    refreshToken: session?.refreshToken,
                    expiresIn: 3600, // Default 1 hour
                    scopes: session?.scope || ''
                })
            });

            const data = await res.json();
            console.log('API Response:', { status: res.status, data });

            if (res.ok) {
                await loadStatus();
                setConnecting(false);
                alert('Google Drive connected successfully!');
            } else {
                console.error('Failed to save credentials:', data);
                alert(`Failed to save Drive credentials: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error saving credentials:', error);
            alert('Error connecting Drive');
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect Google Drive? All users will lose upload access until you reconnect.')) {
            return;
        }

        setDisconnecting(true);
        try {
            const res = await fetch('/api/drive/connect', {
                method: 'DELETE'
            });

            if (res.ok) {
                await loadStatus();
                alert('Google Drive disconnected successfully');
            } else {
                const data = await res.json();
                alert(`Failed to disconnect: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
            alert('Error disconnecting Drive');
        } finally {
            setDisconnecting(false);
        }
    };

    if (profile?.role !== 'admin') {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm text-amber-800">
                    Only admins can manage Google Drive settings.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-md border border-gray-200 p-4">
                <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-600">Loading Drive status...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-md border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Google Drive Integration</h3>
                    <p className="text-xs text-gray-500">Organization-wide file storage</p>
                </div>
            </div>

            {/* Status Display */}
            {driveStatus?.connected ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-medium text-green-900">Drive Connected</p>
                            <p className="text-sm text-green-700 mt-1">
                                All users can upload files to your shared Google Drive
                            </p>
                            {driveStatus.connectedAt && (
                                <p className="text-xs text-green-600 mt-2">
                                    Connected: {new Date(driveStatus.connectedAt).toLocaleString()}
                                </p>
                            )}
                            {driveStatus.isExpired && (
                                <div className="flex items-center gap-2 mt-3 text-amber-700">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm">Token expired - reconnect to enable auto-refresh</span>
                                </div>
                            )}
                            {!driveStatus.isExpired && driveStatus.hasRefreshToken && (
                                <div className="flex items-center gap-2 mt-3 text-blue-700">
                                    <RefreshCw className="w-4 h-4" />
                                    <span className="text-sm">✓ Auto-refresh enabled</span>
                                </div>
                            )}
                            {!driveStatus.hasRefreshToken && !driveStatus.isExpired && (
                                <div className="flex items-center gap-2 mt-3 text-amber-700">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm">Reconnect to enable auto-refresh</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setConnecting(true); handleConnect(); }}
                                disabled={connecting}
                                className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                                {connecting ? 'Connecting...' : 'Reconnect'}
                            </button>
                            <button
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                            >
                                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                    <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div className="flex-1">
                            <p className="font-medium text-amber-900">Drive Not Connected</p>
                            <p className="text-sm text-amber-700 mt-1">
                                Connect your Google account to enable file uploads for all users
                            </p>
                        </div>
                        <button
                            onClick={() => { setConnecting(true); handleConnect(); }}
                            disabled={connecting}
                            className="px-3 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {connecting && <RefreshCw className="w-4 h-4 animate-spin" />}
                            Connect Drive
                        </button>
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="space-y-3">
                <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2" />
                    <p className="text-sm text-gray-600">
                        You&apos;ll authenticate with your Google account that has access to your Shared Drive
                    </p>
                </div>
                <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2" />
                    <p className="text-sm text-gray-600">
                        All employees will use this connection to upload files - no individual logins required
                    </p>
                </div>
                <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2" />
                    <p className="text-sm text-gray-600">
                        Files will be uploaded to your configured Shared Drive folders
                    </p>
                </div>
            </div>
        </div>
    );
}
