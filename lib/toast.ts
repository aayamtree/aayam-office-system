'use client';

/**
 * Global toast utility — replaces native alert() / confirm() everywhere.
 * Import { toast } from '@/lib/toast';
 * Usage:
 *   toast.success('Saved!')
 *   toast.error('Something went wrong')
 *   toast.info('Please wait...')
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number; // ms, default 3500
}

// Internal event bus
const listeners: Set<(opts: ToastOptions) => void> = new Set();

function show(message: string, type: ToastType = 'info', duration = 3500) {
    listeners.forEach(fn => fn({ message, type, duration }));
}

export const toast = {
    success: (msg: string, duration?: number) => show(msg, 'success', duration),
    error: (msg: string, duration?: number) => show(msg, 'error', duration ?? 5000),
    info: (msg: string, duration?: number) => show(msg, 'info', duration),
    warning: (msg: string, duration?: number) => show(msg, 'warning', duration),
    /** subscribe to toast events (used by <ToastContainer>) */
    subscribe: (fn: (opts: ToastOptions) => void) => { listeners.add(fn); return () => listeners.delete(fn); },
};
