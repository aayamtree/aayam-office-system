'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration: number;
}

const ICONS = {
    success: <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />,
    error: <XCircle className="h-4 w-4 text-red-600 shrink-0" />,
    info: <Info className="h-4 w-4 text-blue-600 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />,
};

const STYLES = {
    success: 'bg-white border-green-200 text-green-900',
    error: 'bg-white border-red-200 text-red-900',
    info: 'bg-white border-blue-200 text-blue-900',
    warning: 'bg-white border-amber-200 text-amber-900',
};

let nextId = 1;

export default function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const remove = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        const unsub = toast.subscribe(({ message, type = 'info', duration = 3500 }) => {
            const id = nextId++;
            setToasts(prev => [...prev, { id, message, type, duration }]);
            setTimeout(() => remove(id), duration);
        });
        return () => { unsub(); };
    }, [remove]);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm pointer-events-auto animate-in slide-in-from-right-4 duration-200 ${STYLES[t.type]}`}
                >
                    {ICONS[t.type]}
                    <span className="flex-1">{t.message}</span>
                    <button
                        onClick={() => remove(t.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}
