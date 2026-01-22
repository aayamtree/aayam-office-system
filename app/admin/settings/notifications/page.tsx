'use client';

import { useState } from 'react';
import { Bell, CheckCircle, X } from 'lucide-react';

export default function NotificationSettings() {
    const [permission, setPermission] = useState(
        typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission
            : 'default'
    );
    const [message, setMessage] = useState('');

    const requestPermission = async () => {
        if (!('Notification' in window)) {
            setMessage('Notifications not supported in this browser');
            return;
        }

        try {
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                setMessage('✅ Notifications enabled! You&apos;ll receive alerts.');
                // Send test notification
                new Notification('Aayam Office System', {
                    body: 'Notifications are now enabled!',
                    icon: '/icon-192.png'
                });
            } else if (result === 'denied') {
                setMessage('❌ Notifications blocked. Enable them in browser settings.');
            }
        } catch (error) {
            console.error('Notification error:', error);
            setMessage('Error requesting permission. Try again.');
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Notification Settings</h1>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bell className="text-indigo-600" size={24} />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-bold text-lg mb-2">Push Notifications</h2>
                        <p className="text-gray-600 text-sm mb-4">
                            Get instant alerts for job updates, payments, and important events.
                        </p>

                        {permission === 'granted' ? (
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle size={20} />
                                <span className="font-medium">Notifications Enabled</span>
                            </div>
                        ) : permission === 'denied' ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-800 text-sm">
                                    Notifications are blocked. To enable:
                                    <br />
                                    <strong>iPhone:</strong> Settings → Aayam → Notifications → Allow
                                    <br />
                                    <strong>Desktop:</strong> Browser settings → Site settings → Notifications
                                </p>
                            </div>
                        ) : (
                            <button
                                onClick={requestPermission}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                            >
                                Enable Notifications
                            </button>
                        )}

                        {message && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                                {message}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-bold text-blue-900 mb-2">For iPhone Users:</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Add this site to your home screen (Share → Add to Home Screen)</li>
                    <li>Open the app from the home screen icon</li>
                    <li>Click Enable Notifications button above</li>
                    <li>Tap Allow when iOS asks for permission</li>
                </ol>
            </div>
        </div>
    );
}
