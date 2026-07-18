'use client';

import { useEffect } from 'react';

/**
 * Global "press Esc to close the top-most popup" behaviour.
 *
 * The app has ~48 hand-rolled modals rendered as `<div className="fixed inset-0 bg-black/... flex ...">`.
 * None of them listened for the Escape key. Rather than wire a hook into every modal (error-prone
 * across dozens of files), this single listener finds the top-most visible overlay and triggers its
 * existing close control — so it works everywhere with zero per-modal changes.
 *
 * Strategy (in order):
 *   1. Click the header close "X" button (lucide `X` renders <svg class="lucide-x">).
 *   2. Otherwise click a button labelled Close / Cancel.
 *   3. Otherwise click the backdrop itself (closes modals that close on outside-click).
 *
 * Radix dialogs already handle Escape natively, so we skip those to avoid double-closing.
 */
export default function EscapeToClose() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;

      // Let native <select> dropdowns swallow their own Escape (don't nuke the whole modal).
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'SELECT') return;

      // All full-screen overlays currently in the DOM.
      const overlays = Array.from(
        document.querySelectorAll<HTMLElement>('.fixed.inset-0')
      ).filter((el) => {
        const cls = typeof el.className === 'string' ? el.className : '';
        // Only dark-backdrop popups — skip layout overlays that aren't modals.
        if (!/bg-black/.test(cls)) return false;
        // Radix dialogs handle Esc themselves.
        if (el.closest('[data-radix-portal]') || el.querySelector('[role="dialog"]')) return false;
        // Must be visible on screen.
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (overlays.length === 0) return;

      // Top-most = highest z-index, then last painted in DOM order.
      overlays.sort((a, b) => {
        const za = parseInt(getComputedStyle(a).zIndex, 10) || 0;
        const zb = parseInt(getComputedStyle(b).zIndex, 10) || 0;
        return za - zb;
      });
      const top = overlays[overlays.length - 1];

      // 1) Header close "X" button.
      const xBtn = top.querySelector('svg.lucide-x')?.closest('button') as HTMLElement | null;
      if (xBtn) {
        e.preventDefault();
        xBtn.click();
        return;
      }

      // 2) A button explicitly labelled Close / Cancel.
      const labelled = Array.from(top.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
        const label = (b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase();
        return label === 'close' || label === 'cancel';
      });
      if (labelled) {
        e.preventDefault();
        labelled.click();
        return;
      }

      // 3) Fallback: click the backdrop (closes modals with an outside-click handler; harmless otherwise).
      e.preventDefault();
      top.click();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
