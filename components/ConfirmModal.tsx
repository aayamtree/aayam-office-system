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
    /**
     * Make the person TYPE this exact word before the button works — for
     * anything that destroys a record. `inputRequired` only checks that the box
     * is non-empty, which a fast hand clears just as easily as a Yes button.
     * Case-insensitive; whitespace trimmed. Implies showInput.
     */
    requireExactInput?: string;
    /** Extra consequence lines, listed under the message. */
    consequences?: string[];
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

// The one place that decides whether the confirm button may fire.
function inputSatisfied(opts: ConfirmOptions, value: string) {
    if (opts.requireExactInput) {
        return value.trim().toUpperCase() === opts.requireExactInput.trim().toUpperCase();
    }
    if (opts.showInput && opts.inputRequired) return !!value.trim();
    return true;
}

// ─── Portal wrapper: renders at document.body level ────────
function ConfirmPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;
    return createPortal(children, document.body);
}

const variantStyles = {
    default: { bg: 'bg-gray-900', hover: 'hover:bg-gray-800', icon: <CheckCircle size={20} className="text-gray-600" /> },
    danger: { bg: 'bg-red-600', hover: 'hover:bg-red-700', icon: <AlertCircle size={20} className="text-red-500" /> },
    success: { bg: 'bg-green-600', hover: 'hover:bg-green-700', icon: <CheckCircle size={20} className="text-green-500" /> },
    warning: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', icon: <AlertCircle size={20} className="text-amber-500" /> },
};

/**
 * The dialog itself, deliberately a separate component from the provider.
 *
 * The typed value lives in THIS component's state. It used to live in a ref on
 * the provider, which had to force a re-render of the provider on every
 * keystroke — and the provider wraps the entire admin tree, so typing D-E-L-E-T-E
 * re-rendered the whole Jobs board six times. Here the keystroke re-renders a
 * dialog and nothing else.
 */
function ConfirmDialog({
    options,
    onConfirm,
    onCancel,
}: {
    options: ConfirmOptions;
    onConfirm: (value: string) => void;
    onCancel: () => void;
}) {
    const [value, setValue] = useState('');
    const readyRef = useRef(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const wantsInput = !!(options.showInput || options.requireExactInput);
    const satisfied = inputSatisfied(options, value);

    // Protect against an immediate backdrop dismiss from the trigger button's
    // own click still propagating when the dialog mounts.
    useEffect(() => {
        const t = setTimeout(() => { readyRef.current = true; }, 200);
        return () => clearTimeout(t);
    }, []);

    // Somewhere inside the dialog must hold focus, or Escape and Tab still
    // belong to the page behind the backdrop. The input takes it when there is
    // one; otherwise Cancel does — never the destructive button. On close the
    // focus goes back to whatever opened the dialog, so a keyboard or screen
    // reader user is not dropped at the top of the page after every delete
    // (that restore lives in the provider, which still knows what was focused
    // when the dialog was asked for — by the time this component mounts, the
    // autofocused input has already taken it).
    useEffect(() => {
        if (!wantsInput) cancelRef.current?.focus();
    }, [wantsInput]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
        if (e.key !== 'Tab') return;
        // Keep Tab inside the dialog.
        const card = cardRef.current;
        if (!card) return;
        const focusable = card.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href], select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !card.contains(active))) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (active === last || !card.contains(active))) {
            e.preventDefault(); first.focus();
        }
    }, [onCancel]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const v = variantStyles[options.variant || 'default'];

    return (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 99999, isolation: 'isolate', pointerEvents: 'auto' }}
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!readyRef.current) return;
                onCancel();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            {/* Modal */}
            <div
                ref={cardRef}
                data-confirm-dialog=""
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => { e.stopPropagation(); }}
                onMouseDown={(e) => { e.stopPropagation(); }}
            >
                <div className="p-5">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5">{v.icon}</div>
                        <div className="flex-1">
                            <h3 id="confirm-dialog-title" className="text-sm font-bold text-gray-900 mb-1">{options.title}</h3>
                            <p id="confirm-dialog-message" className="text-xs text-gray-500 leading-relaxed">{options.message}</p>
                        </div>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {options.consequences && options.consequences.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                            {options.consequences.map((c, i) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                                    <span className="text-red-500 shrink-0" aria-hidden="true">&bull;</span>
                                    <span>{c}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {wantsInput && (
                        <div className="mt-4">
                            {options.requireExactInput && (
                                <label htmlFor="confirm-typed-input" className="block text-xs text-gray-600 mb-1.5">
                                    Type <b className="font-mono font-bold text-gray-900">{options.requireExactInput}</b> to confirm
                                </label>
                            )}
                            <input
                                id="confirm-typed-input"
                                autoFocus
                                type="text"
                                autoComplete="off"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && inputSatisfied(options, value)) onConfirm(value); }}
                                placeholder={options.inputPlaceholder || (options.requireExactInput ? options.requireExactInput : 'Type here...')}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 ring-primary/20 outline-none"
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-2 p-4 pt-0">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
                        className="flex-1 py-2.5 rounded-md text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        {options.cancelLabel || 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfirm(value); }}
                        disabled={!satisfied}
                        className={`flex-1 py-2.5 rounded-md text-sm font-bold text-white ${v.bg} ${v.hover} transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                        {options.confirmLabel || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    // Use ref to hold modal state so parent re-renders NEVER clear it
    const optionsRef = useRef<ConfirmOptions | null>(null);
    const resolveRef = useRef<(result: ConfirmResult) => void>();
    const seqRef = useRef(0);
    // Whatever had focus when the dialog was asked for — captured here, in the
    // click handler itself, before the dialog mounts and steals it.
    const openerRef = useRef<HTMLElement | null>(null);

    // Force-update mechanism (immune to parent state changes)
    const [, setTick] = useState(0);
    const forceUpdate = useCallback(() => setTick(t => t + 1), []);

    const confirm = useCallback<ConfirmFn>((opts) => {
        return new Promise<ConfirmResult>((resolve) => {
            // A dialog already open is answered as a cancel rather than left
            // with a promise nobody ever settles.
            resolveRef.current?.({ confirmed: false });
            // Capture the opener only when focus is somewhere on the PAGE. When
            // one confirm's continuation opens another, focus is still inside
            // the dialog being torn down; capturing that would leave nothing to
            // return to, so the original trigger is carried through the chain.
            const active = document.activeElement as HTMLElement | null;
            const insideDialog = !!(active && typeof active.closest === 'function' && active.closest('[data-confirm-dialog]'));
            if (!insideDialog) openerRef.current = active;
            seqRef.current += 1;
            optionsRef.current = opts;
            resolveRef.current = resolve;
            forceUpdate();
        });
    }, [forceUpdate]);

    const settle = useCallback((result: ConfirmResult) => {
        const resolve = resolveRef.current;
        const opener = openerRef.current;
        resolveRef.current = undefined;
        optionsRef.current = null;
        forceUpdate();
        if (opener && typeof opener.focus === 'function') {
            // Deferred past the unmount, or focus lands on an element that is
            // about to disappear. If a NEW dialog has opened by then — resolving
            // this promise can run a continuation that asks for a second confirm
            // — leave the opener where it is and let THAT dialog hand it back,
            // rather than yanking focus out of the dialog now on screen.
            setTimeout(() => {
                if (optionsRef.current) return;
                openerRef.current = null;
                if (document.contains(opener)) opener.focus();
            }, 0);
        } else {
            openerRef.current = null;
        }
        resolve?.(result);
    }, [forceUpdate]);

    const handleConfirm = useCallback((value: string) => {
        const opts = optionsRef.current;
        if (!opts || !inputSatisfied(opts, value)) return;
        settle({ confirmed: true, inputValue: value.trim() });
    }, [settle]);

    const handleCancel = useCallback(() => {
        settle({ confirmed: false });
    }, [settle]);

    const options = optionsRef.current;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {options && (
                <ConfirmPortal>
                    {/* keyed by sequence so a fresh dialog never inherits the last one's typed text */}
                    <ConfirmDialog
                        key={seqRef.current}
                        options={options}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                    />
                </ConfirmPortal>
            )}
        </ConfirmContext.Provider>
    );
}
