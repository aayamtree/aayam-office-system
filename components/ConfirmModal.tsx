'use client';

import { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger' | 'success' | 'warning';
    showInput?: boolean;
    inputPlaceholder?: string;
    inputRequired?: boolean;
}

interface ConfirmResult {
    confirmed: boolean;
    inputValue?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<ConfirmResult>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
    const fn = useContext(ConfirmContext);
    if (!fn) throw new Error('useConfirm must be used within ConfirmProvider');
    return fn;
}

// ─── Portal wrapper: renders at document.body level ────────
function ConfirmPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;
    return createPortal(children, document.body);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    // Use ref to hold modal state so parent re-renders NEVER clear it
    const optionsRef = useRef<ConfirmOptions | null>(null);
    const resolveRef = useRef<(result: ConfirmResult) => void>();
    const readyRef = useRef(false);
    const inputRef = useRef('');

    // Force-update mechanism (immune to parent state changes)
    const [, setTick] = useState(0);
    const forceUpdate = useCallback(() => setTick(t => t + 1), []);

    const confirm = useCallback<ConfirmFn>((opts) => {
        return new Promise<ConfirmResult>((resolve) => {
            readyRef.current = false;
            optionsRef.current = opts;
            inputRef.current = '';
            resolveRef.current = resolve;
            forceUpdate();
            // Protect against immediate backdrop dismiss from the trigger button's click propagation
            setTimeout(() => { readyRef.current = true; }, 200);
        });
    }, [forceUpdate]);

    const handleConfirm = useCallback(() => {
        const opts = optionsRef.current;
        if (opts?.showInput && opts.inputRequired && !inputRef.current.trim()) return;
        resolveRef.current?.({ confirmed: true, inputValue: inputRef.current.trim() });
        optionsRef.current = null;
        forceUpdate();
    }, [forceUpdate]);

    const handleCancel = useCallback(() => {
        resolveRef.current?.({ confirmed: false });
        optionsRef.current = null;
        forceUpdate();
    }, [forceUpdate]);

    // ── Close on ESC ──
    useEffect(() => {
        if (!optionsRef.current) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    });

    const handleBackdropDismiss = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!readyRef.current) return;
        handleCancel();
    }, [handleCancel]);

    const handleInputChange = useCallback((val: string) => {
        inputRef.current = val;
        forceUpdate();
    }, [forceUpdate]);

    const options = optionsRef.current;

    const variantStyles = {
        default: { bg: 'bg-gray-900', hover: 'hover:bg-gray-800', icon: <CheckCircle size={20} className="text-gray-600" /> },
        danger: { bg: 'bg-red-600', hover: 'hover:bg-red-700', icon: <AlertCircle size={20} className="text-red-500" /> },
        success: { bg: 'bg-green-600', hover: 'hover:bg-green-700', icon: <CheckCircle size={20} className="text-green-500" /> },
        warning: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', icon: <AlertCircle size={20} className="text-amber-500" /> },
    };

    const v = options ? variantStyles[options.variant || 'default'] : variantStyles.default;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {options && (
                <ConfirmPortal>
                    <div
                        className="fixed inset-0 flex items-center justify-center"
                        style={{ zIndex: 99999, isolation: 'isolate', pointerEvents: 'auto' }}
                        onMouseDown={handleBackdropDismiss}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        {/* Modal */}
                        <div
                            className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                            style={{ pointerEvents: 'auto' }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <div className="p-5">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">{v.icon}</div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-gray-900 mb-1">{options.title}</h3>
                                        <p className="text-xs text-gray-500 leading-relaxed">{options.message}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancel(); }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {options.showInput && (
                                    <div className="mt-4">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={inputRef.current}
                                            onChange={(e) => handleInputChange(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                                            placeholder={options.inputPlaceholder || 'Type here...'}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 p-4 pt-0">
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancel(); }}
                                    className="flex-1 py-2.5 rounded-md text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    {options.cancelLabel || 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleConfirm(); }}
                                    disabled={options.showInput && options.inputRequired && !inputRef.current.trim()}
                                    className={`flex-1 py-2.5 rounded-md text-sm font-bold text-white ${v.bg} ${v.hover} transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    {options.confirmLabel || 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </ConfirmPortal>
            )}
        </ConfirmContext.Provider>
    );
}
