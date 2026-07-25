'use client';

import { useState, ReactNode, useRef } from 'react';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';

type State = 'idle' | 'loading' | 'done' | 'error';

interface ActionButtonProps {
  /**
   * The action to run. MUST resolve only when the work truly succeeded.
   * Signal failure by throwing, or by returning an object with an `error`
   * (string) / `{ ok: false }`. Only then does the button show "done".
   */
  onAction: () => Promise<unknown>;
  /** Idle label / content. */
  children: ReactNode;
  /** Label shown after a successful action (defaults to a ✓ + children). */
  doneLabel?: ReactNode;
  /** Label shown while running. */
  loadingLabel?: ReactNode;
  /**
   * Externally-derived "already done" — e.g. the DB already says this is done.
   * When true the button renders in its done state and cannot be pressed.
   * This is what makes the confirmation survive a page reload.
   */
  done?: boolean;
  /** Once completed, stay in the done state (default true). */
  stayDone?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Extra classes applied in the done state. */
  doneClassName?: string;
  /** Toast on success. Pass null to suppress. */
  successToast?: string | null;
  /** Toast on failure (prefix). The underlying error message is appended. */
  errorToast?: string;
  type?: 'button' | 'submit';
}

/**
 * A button that gives HONEST, PERSISTENT feedback:
 *  - disables itself while the action runs (no double-tap / no spamming)
 *  - only switches to "done" after the action actually succeeds
 *  - shows an error state (and re-enables for retry) if it fails
 *  - can be told it's already done via `done` so the state survives reload
 */
export default function ActionButton({
  onAction,
  children,
  doneLabel,
  loadingLabel,
  done = false,
  stayDone = true,
  disabled = false,
  title,
  className = '',
  doneClassName = '',
  successToast,
  errorToast = 'Action failed',
  type = 'button',
}: ActionButtonProps) {
  const [state, setState] = useState<State>('idle');
  const runningRef = useRef(false);

  const isDone = done || (stayDone && state === 'done');
  const isLoading = state === 'loading';
  const locked = disabled || isLoading || isDone;

  const handleClick = async () => {
    if (locked || runningRef.current) return;
    runningRef.current = true;
    setState('loading');
    try {
      const result: any = await onAction();
      if (result && (result.error || result.ok === false || result.success === false)) {
        const msg = typeof result.error === 'string' ? result.error : (result.message || 'Failed');
        throw new Error(msg);
      }
      setState('done');
      if (successToast !== null) toast.success(successToast || 'Done ✓');
    } catch (e: any) {
      setState('error');
      toast.error(`${errorToast}${e?.message ? `: ${e.message}` : ''}`);
    } finally {
      runningRef.current = false;
    }
  };

  const content: ReactNode = isLoading
    ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="w-4 h-4 animate-spin" />
        {loadingLabel || 'Working…'}
      </span>
    )
    : isDone
      ? (
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4" />
          {doneLabel || children}
        </span>
      )
      : state === 'error'
        ? (
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {children}
          </span>
        )
        : children;

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={locked}
      title={title}
      aria-busy={isLoading}
      className={[
        className,
        isDone ? doneClassName : '',
        locked ? 'cursor-default' : '',
        isLoading ? 'opacity-80' : '',
      ].filter(Boolean).join(' ')}
    >
      {content}
    </button>
  );
}
