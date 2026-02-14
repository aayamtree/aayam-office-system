'use client';

import { useState, useCallback, createContext, useContext, useRef } from 'react';
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

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [inputValue, setInputValue] = useState('');
    const resolveRef = useRef<(result: ConfirmResult) => void>();

    const confirm = useCallback<ConfirmFn>((opts) => {
        return new Promise<ConfirmResult>((resolve) => {
            setOptions(opts);
            setInputValue('');
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        if (options?.showInput && options.inputRequired && !inputValue.trim()) return;
        resolveRef.current?.({ confirmed: true, inputValue: inputValue.trim() });
        setOptions(null);
    };

    const handleCancel = () => {
        resolveRef.current?.({ confirmed: false });
        setOptions(null);
    };

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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={handleCancel}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    {/* Modal */}
                    <div
                        className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">{v.icon}</div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">{options.title}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">{options.message}</p>
                                </div>
                                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>

                            {options.showInput && (
                                <div className="mt-4">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                                        placeholder={options.inputPlaceholder || 'Type here...'}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 p-4 pt-0">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                {options.cancelLabel || 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={options.showInput && options.inputRequired && !inputValue.trim()}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white ${v.bg} ${v.hover} transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {options.confirmLabel || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
