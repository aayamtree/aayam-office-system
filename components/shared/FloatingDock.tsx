'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, X, MessageCircle, GripVertical } from 'lucide-react';
import GSTCalculator from './GSTCalculator';

/**
 * Floating dock: GST calculator + team chat, draggable vertically along the right
 * edge so it can be moved out of the way of inputs (e.g. the POS pay area).
 * Vertical offset is persisted in localStorage.
 */
export default function FloatingDock({ onOpenChat }: { onOpenChat: () => void }) {

  const [calcOpen, setCalcOpen] = useState(false);
  const [offsetY, setOffsetY] = useState(0); // px the dock is lifted above its default bottom
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startOffset = useRef(0);

  // Restore saved position
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('floatingDockOffsetY') : null;
    if (saved) setOffsetY(Math.max(0, parseInt(saved) || 0));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startOffset.current = offsetY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [offsetY]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY; // up = positive
      const max = window.innerHeight - 160;
      const next = Math.max(0, Math.min(max, startOffset.current + delta));
      setOffsetY(next);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      try { localStorage.setItem('floatingDockOffsetY', String(offsetY)); } catch {}
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [offsetY]);

  // Close calculator on outside click / Escape
  useEffect(() => {
    if (!calcOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setCalcOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalcOpen(false); };
    document.addEventListener('mousedown', handler);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); window.removeEventListener('keydown', esc); };
  }, [calcOpen]);

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', right: '20px', bottom: `${24 + offsetY}px`, zIndex: 50 }}
      className="flex flex-col items-end gap-3"
    >
      {/* GST Calculator slide-up panel */}
      {calcOpen && (
        <div className="bg-background border border-border rounded-2xl shadow-xl p-5 w-80 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">GST Calculator</span>
            </div>
            <button onClick={() => setCalcOpen(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <GSTCalculator compact={true} />
        </div>
      )}

      {/* Dock cluster */}
      <div className="flex flex-col items-center gap-2">
        {/* Drag handle */}
        <button
          onPointerDown={onPointerDown}
          title="Drag to move up / down"
          className="w-9 h-6 rounded-full bg-background border border-border text-muted-foreground flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-muted touch-none"
          aria-label="Move floating buttons"
        >
          <GripVertical className="w-4 h-4 rotate-90" />
        </button>

        {/* Team chat */}
        <button
          onClick={onOpenChat}
          title="Team Chat"
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #2b5278, #1a3a5c)' }}
        >
          <MessageCircle size={22} strokeWidth={1.8} />
        </button>

        {/* GST calculator — a tool, so it lives in the dock on every screen. */}
        <button
          onClick={() => setCalcOpen(v => !v)}
          title="GST Calculator"
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${calcOpen ? 'bg-foreground text-background' : 'bg-background border border-border text-foreground hover:bg-muted'}`}
        >
          <Calculator className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
