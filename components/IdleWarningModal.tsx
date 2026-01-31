'use client';

import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface IdleWarningModalProps {
    show: boolean;
    onStayLoggedIn: () => void;
    onLogout: () => void;
}

export function IdleWarningModal({ show, onStayLoggedIn, onLogout }: IdleWarningModalProps) {
    const [timeLeft, setTimeLeft] = useState(5); // 5 minutes

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
                {/* Icon */}
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-yellow-600" size={32} />
                </div>

                {/* Title */}
                <h2 className="text-page-title text-gray-900 text-center mb-2">
                    Still there?
                </h2>

                {/* Message */}
                <p className="text-gray-600 text-center mb-6">
                    You&apos;ve been inactive for 55 minutes. You&apos;ll be automatically logged out in <strong>5 minutes</strong> for security.
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onLogout}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                    >
                        Logout Now
                    </button>
                    <button
                        onClick={onStayLoggedIn}
                        className="flex-1 px-4 py-3 bg-[rgba(0,0,255,0.1)] text-white rounded-xl hover:bg-[rgba(0,0,255,0.1)] font-medium transition-colors"
                    >
                        Stay Logged In
                    </button>
                </div>
            </div>
        </div>
    );
}
