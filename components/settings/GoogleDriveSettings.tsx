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
        setConnecting(true); // Set BEFORE signIn

        // Authenticate with Google
        const result = await signIn('google', {
            callbackUrl: window.location.href,
            redirect: false
        });

        console.log('SignIn result:', result);
    };

    // After Google OAuth, save credentials to database
    useEffect(() => {
        console.log('Session changed:', {
            hasAccessToken: !!session?.accessToken,
            connecting,
            session
        });

        if (session?.accessToken && connecting) {
            console.log('Triggering saveCredentials...');
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

    if (profile?.role !== 'admin') {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                    Only admins can manage Google Drive settings.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-600">Loading Drive status...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">Google Drive Integration</h3>
                    <p className="text-sm text-gray-500">Organization-wide file storage</p>
                </div>
            </div>

            {/* Status Display */}
            {driveStatus?.connected ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
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
                                    <span className="text-sm">Token expired - please reconnect</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => { setConnecting(true); handleConnect(); }}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                            Reconnect
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
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
                            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
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
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2" />
                    <p className="text-sm text-gray-600">
                        You&apos;ll authenticate with your Google account that has access to your Shared Drive
                    </p>
                </div>
                <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2" />
                    <p className="text-sm text-gray-600">
                        All employees will use this connection to upload files - no individual logins required
                    </p>
                </div>
                <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2" />
                    <p className="text-sm text-gray-600">
                        Files will be uploaded to your configured Shared Drive folders
                    </p>
                </div>
            </div>
        </div>
    );
}
