'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Cloud, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/ConfirmModal';

export default function GoogleDriveSettings() {
    const { profile } = useAuth();
    const [driveStatus, setDriveStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const confirm = useConfirm();

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

    // Check URL params for OAuth callback results
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get('drive_connected');
        const error = params.get('drive_error');

        if (connected === 'true') {
            toast.success('Google Drive connected successfully!');
            // Clean up URL params
            window.history.replaceState({}, '', window.location.pathname);
            loadStatus();
        }

        if (error) {
            toast.error(`Drive connection error: ${decodeURIComponent(error)}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Handle Google Drive connection - direct OAuth (no NextAuth)
    const handleConnect = async () => {
        setConnecting(true);

        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
            toast.info('Google Client ID not configured. Contact admin.');
            setConnecting(false);
            return;
        }

        // Note: we intentionally do NOT revoke/delete the existing connection here.
        // The callback deactivates the old credential and inserts the new one, so the
        // connection is preserved if the admin cancels the Google screen. We still ask
        // for `consent` below, which guarantees Google returns a fresh refresh_token.

        const baseUrl = window.location.origin;
        const redirectUri = `${baseUrl}/api/drive/callback`;
        const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events';
        const state = profile?.id || ''; // Pass user ID as state

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scope)}` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(state)}`;

        // Redirect to Google OAuth directly
        window.location.href = authUrl;
    };

    const handleDisconnect = async () => {
        const { confirmed } = await confirm({ title: 'Disconnect Google Drive', message: 'Are you sure you want to disconnect Google Drive? All users will lose upload access until you reconnect.', variant: 'danger', confirmLabel: 'Disconnect' });
        if (!confirmed) {
            return;
        }

        setDisconnecting(true);
        try {
            const res = await fetch('/api/drive/connect', {
                method: 'DELETE'
            });

            if (res.ok) {
                await loadStatus();
                toast.success('Google Drive disconnected successfully');
            } else {
                const data = await res.json();
                toast.error(`Failed to disconnect: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
            toast.error('Error disconnecting Drive');
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
                                onClick={handleConnect}
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
                            onClick={handleConnect}
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
