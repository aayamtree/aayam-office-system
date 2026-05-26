'use client';

import { useState, useRef, useEffect } from 'react';
import { Calculator, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import GSTCalculator from './GSTCalculator';

export default function GSTCalculatorFloat() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Don't show floater on the dashboard — it has the full embedded version there
  if (pathname?.includes('/dashboard')) return null;

  const toggle = () => setOpen(v => !v);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Slide-up panel */}
      {open && (
        <div className="bg-background border border-border rounded-2xl shadow-xl p-5 w-80 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">GST Calculator</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <GSTCalculator compact={true} />
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={toggle}
        title="GST Calculator"
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${open
          ? 'bg-foreground text-background'
          : 'bg-background border border-border text-foreground hover:bg-muted'
          }`}
      >
        <Calculator className="w-5 h-5" />
      </button>
    </div>
  );
}
