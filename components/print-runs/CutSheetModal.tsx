'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Scissors, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';

type RunJob = { job_id: string; job_number?: string; client_name?: string; item_name?: string; qty?: number | null; has_thumb?: boolean };
type Box = { x: number; y: number; w: number; h: number };

interface Props {
  runId: string;
  sheetUrl: string;
  jobs: RunJob[];
  onClose: () => void;
  onSaved?: () => void;
}

const COLORS = ['#ef4444', '#3b82f6', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d'];

// Sheet picture → (a) small copy for the AI to read, (b) full-size image for cropping.
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the sheet picture'));
    img.src = url;
  });
}
function toJpegBase64(img: HTMLImageElement, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
function cropToBlob(img: HTMLImageElement, b: Box, maxSide = 700): Promise<Blob> {
  const sw = Math.max(1, Math.round(b.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(b.h * img.naturalHeight));
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  c.getContext('2d')!.drawImage(img, Math.round(b.x * img.naturalWidth), Math.round(b.y * img.naturalHeight), sw, sh, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(bl => (bl ? res(bl) : rej(new Error('Crop failed'))), 'image/jpeg', 0.88));
}

export default function CutSheetModal({ runId, sheetUrl, jobs, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<'loading' | 'review' | 'saving' | 'error'>('loading');
  const [error, setError] = useState('');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box | null>>({});
  const [confidence, setConfidence] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [apply, setApply] = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 1 = whole sheet fits the window; bigger = zoomed in (scroll to move around).
  const [zoom, setZoom] = useState(1);
  const focusAfterZoom = useRef<string | null>(null);
  const drag = useRef<null | { jobId: string; mode: 'move' | 'draw'; sx: number; sy: number; start: Box }>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const full = await loadImage(sheetUrl);
        if (dead) return;
        setImg(full);
        const res = await fetch('/api/print-runs/detect-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: toJpegBase64(full, 2000),
            jobs: jobs.map(j => ({ id: j.job_id, client: j.client_name || '', name: j.item_name || '', qty: j.qty })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Scan failed (${res.status})`);
        if (dead) return;
        const b: Record<string, Box | null> = {};
        const c: Record<string, string> = {};
        const a: Record<string, boolean> = {};
        jobs.forEach(j => { b[j.job_id] = null; a[j.job_id] = false; });
        (data.matches || []).forEach((m: any) => {
          b[m.job_id] = { x: m.x, y: m.y, w: m.w, h: m.h };
          c[m.job_id] = m.confidence;
          a[m.job_id] = true;
        });
        setBoxes(b); setConfidence(c); setApply(a);
        setActive(jobs.find(j => b[j.job_id])?.job_id || jobs[0]?.job_id || null);
        setPhase('review');
      } catch (e: any) {
        if (!dead) { setError(e.message || 'Something went wrong'); setPhase('error'); }
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pt = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  // Drag inside the active box = move it; drag on empty sheet = draw a new box for the active job.
  const onDown = (e: React.PointerEvent) => {
    if (!active || phase !== 'review') return;
    const p = pt(e);
    const cur = boxes[active];
    const inside = cur && p.x >= cur.x && p.x <= cur.x + cur.w && p.y >= cur.y && p.y <= cur.y + cur.h;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (inside && cur) drag.current = { jobId: active, mode: 'move', sx: p.x, sy: p.y, start: cur };
    else {
      drag.current = { jobId: active, mode: 'draw', sx: p.x, sy: p.y, start: { x: p.x, y: p.y, w: 0, h: 0 } };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = pt(e);
    if (d.mode === 'move') {
      const nx = clamp01(d.start.x + (p.x - d.sx)), ny = clamp01(d.start.y + (p.y - d.sy));
      setBoxes(prev => ({ ...prev, [d.jobId]: { ...d.start, x: Math.min(nx, 1 - d.start.w), y: Math.min(ny, 1 - d.start.h) } }));
    } else {
      const x = Math.min(d.sx, p.x), y = Math.min(d.sy, p.y);
      setBoxes(prev => ({ ...prev, [d.jobId]: { x: clamp01(x), y: clamp01(y), w: clamp01(Math.abs(p.x - d.sx)), h: clamp01(Math.abs(p.y - d.sy)) } }));
    }
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (d?.mode === 'draw') {
      setBoxes(prev => {
        const b = prev[d.jobId];
        if (b && (b.w < 0.01 || b.h < 0.01)) {
          toast.error('That box is too small — drag a rectangle around the whole label');
          return { ...prev, [d.jobId]: d.start.w ? d.start : null };
        }
        return prev;
      });
      setApply(prev => ({ ...prev, [d.jobId]: true }));
    }
  };

  const MAX_ZOOM = 8;
  const changeZoom = (f: number) => setZoom(z => Math.min(MAX_ZOOM, Math.max(1, +(z * f).toFixed(3))));

  // Zoom so the chosen job's box fills most of the window, and scroll it to the middle.
  const zoomToBox = (jobId: string) => {
    const b = boxes[jobId]; const sc = scrollRef.current;
    if (!b || !sc || !img) return;
    const contW = sc.clientWidth - 24, contH = sc.clientHeight - 24;
    const aspect = img.naturalHeight / img.naturalWidth;
    const z = Math.min(0.75 / Math.max(b.w, 0.01), (0.8 * contH) / (Math.max(b.h, 0.01) * contW * aspect));
    focusAfterZoom.current = jobId;
    setZoom(Math.min(MAX_ZOOM, Math.max(1, z)));
  };
  useEffect(() => {
    const id = focusAfterZoom.current;
    if (!id) return;
    focusAfterZoom.current = null;
    const b = boxes[id]; const sc = scrollRef.current; const wrap = wrapRef.current;
    if (!b || !sc || !wrap) return;
    requestAnimationFrame(() => {
      sc.scrollTo({
        left: wrap.offsetLeft + (b.x + b.w / 2) * wrap.offsetWidth - sc.clientWidth / 2,
        top: wrap.offsetTop + (b.y + b.h / 2) * wrap.offsetHeight - sc.clientHeight / 2,
        behavior: 'smooth',
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const save = async () => {
    if (!img) return;
    const todo = jobs.filter(j => apply[j.job_id] && boxes[j.job_id]);
    if (todo.length === 0) { toast.error('Tick at least one job that has a box'); return; }
    setPhase('saving');
    try {
      for (const j of todo) {
        const blob = await cropToBlob(img, boxes[j.job_id]!);
        const path = `jobs/${j.job_id}/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const up = await supabase.storage.from('attachments').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const url = supabase.storage.from('attachments').getPublicUrl(path).data?.publicUrl;
        const { error } = await supabase.from('jobs').update({ thumbnail_url: url, updated_at: new Date().toISOString() }).eq('id', j.job_id);
        if (error) throw error;
      }
      toast.success(`Saved ${todo.length} product picture${todo.length > 1 ? 's' : ''}`);
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error('Could not save pictures: ' + (e.message || 'Unknown error'));
      setPhase('review');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm flex items-center gap-2"><Scissors className="w-4 h-4" /> Cut product pictures from this sheet</p>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {phase === 'loading' && (
          <div className="p-10 text-center text-sm text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Reading the sheet and finding each product…</div>
        )}
        {phase === 'error' && (
          <div className="p-8 text-center"><p className="text-sm text-red-600 mb-3">{error}</p><button onClick={onClose} className="px-3 py-1.5 text-sm border rounded-md">Close</button></div>
        )}

        {(phase === 'review' || phase === 'saving') && img && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-gray-50">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-white text-xs">
                <button type="button" onClick={() => changeZoom(1 / 1.5)} disabled={zoom <= 1} className="p-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-40" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
                <span className="w-12 text-center font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => changeZoom(1.5)} disabled={zoom >= MAX_ZOOM} className="p-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-40" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
                <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} className="px-2 py-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" /> Whole sheet</button>
                <button type="button" onClick={() => active && zoomToBox(active)} disabled={!active || !boxes[active || '']} className="px-2 py-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-40">Zoom to selected box</button>
                <span className="ml-auto text-gray-500 hidden lg:inline">Tip: click a job on the right to zoom to it</span>
              </div>
              {active && (() => {
                const aj = jobs.find(j => j.job_id === active);
                if (!aj) return null;
                const has = !!boxes[active];
                return (
                  <div className={`px-3 py-2 text-xs border-b ${has ? 'bg-white text-gray-700' : 'bg-amber-50 text-amber-900 font-medium'}`}>
                    {has
                      ? <>Selected: <b>#{aj.job_number}</b>. Drag inside its box to move it, or drag on an empty spot to draw it again.</>
                      : <>Selected: <b>#{aj.job_number}</b> was not found. <b>Drag a rectangle on the sheet around its label</b> (zoom in first if it is small). It ticks itself when the box is drawn.</>}
                  </div>
                );
              })()}
              <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-3">
              <div ref={wrapRef}
                style={zoom > 1 ? { width: `${zoom * 100}%` } : undefined}
                className={`relative select-none touch-none cursor-crosshair ${zoom > 1 ? 'block' : 'inline-block max-w-full'}`}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sheetUrl} alt="Sheet" draggable={false} className={zoom > 1 ? 'block w-full h-auto' : 'block max-w-full max-h-[70vh] w-auto'} />
                {jobs.map((j, i) => {
                  const b = boxes[j.job_id]; if (!b) return null;
                  const col = COLORS[i % COLORS.length];
                  return (
                    <div key={j.job_id} style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, borderColor: col, opacity: apply[j.job_id] ? 1 : 0.4 }}
                      className={`absolute border-2 pointer-events-none ${active === j.job_id ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.9)]' : ''}`}>
                      <span style={{ background: col }} className="absolute -top-0.5 -left-0.5 text-[10px] text-white px-1 leading-4 font-bold">{j.job_number || i + 1}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Pick a job on the right, then drag on the sheet to draw its box, or drag an existing box to move it.</p>
              </div>
            </div>

            <div className="md:w-72 border-t md:border-t-0 md:border-l overflow-auto p-3 space-y-2">
              {jobs.map((j, i) => {
                const has = !!boxes[j.job_id];
                return (
                  <div key={j.job_id} onClick={() => { setActive(j.job_id); if (boxes[j.job_id]) zoomToBox(j.job_id); }}
                    className={`rounded-md border p-2 cursor-pointer ${active === j.job_id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 accent-gray-900" checked={!!apply[j.job_id]} disabled={!has}
                        onChange={e => setApply(prev => ({ ...prev, [j.job_id]: e.target.checked }))} onClick={e => e.stopPropagation()} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                          <span style={{ background: COLORS[i % COLORS.length] }} className="inline-block w-2 h-2 rounded-sm" />#{j.job_number}
                        </p>
                        <p className="text-xs font-semibold text-gray-900 leading-snug">{j.item_name || '—'}</p>
                        <p className="text-[10px] text-gray-500 truncate">{j.client_name}</p>
                        <p className={`text-[10px] mt-0.5 ${has ? (confidence[j.job_id] === 'high' ? 'text-green-700' : 'text-amber-700') : 'text-red-600'}`}>
                          {has ? (confidence[j.job_id] ? `Found (${confidence[j.job_id]} confidence) — check it` : 'Box drawn by hand') : 'Not found — click here, then drag a box on the sheet'}
                          {j.has_thumb && ' · already has a picture'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(phase === 'review' || phase === 'saving') && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
            <button onClick={onClose} disabled={phase === 'saving'} className="px-3 py-1.5 text-sm border rounded-md">Cancel</button>
            <button onClick={save} disabled={phase === 'saving'} className="px-4 py-1.5 text-sm bg-gray-900 text-white rounded-md font-semibold disabled:opacity-50 flex items-center gap-2">
              {phase === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />} Save ticked pictures
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
