'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
export type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
export type LayoutsMap = { lg: LayoutItem[]; md: LayoutItem[]; sm: LayoutItem[] };

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const DEFAULT_STORAGE_KEY = 'aayam-dashboard-layouts-v3';

// ─── Persistence ───────────────────────────────────────────────
function loadSavedLayouts(key: string): LayoutsMap | null {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
    } catch { }
    return null;
}

function saveLayoutsToStorage(key: string, layouts: LayoutsMap) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(layouts));
    } catch { }
}

export function resetLayouts(storageKey?: string) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(storageKey || DEFAULT_STORAGE_KEY);
}

// ─── Breakpoint detection ──────────────────────────────────────
type Breakpoint = 'lg' | 'md' | 'sm';
function getBreakpoint(width: number): Breakpoint {
    if (width >= 1024) return 'lg';
    if (width >= 640) return 'md';
    return 'sm';
}
function getCols(bp: Breakpoint): number {
    return bp === 'lg' ? 12 : bp === 'md' ? 6 : 2;
}

// ─── Props ─────────────────────────────────────────────────────
interface DashboardGridProps {
    defaultLayouts: LayoutsMap;
    isLocked: boolean;
    storageKey?: string;
    children: React.ReactNode;
}

// ─── Resize state ──────────────────────────────────────────────
interface ResizeState {
    id: string;
    dir: ResizeDir;
    startMouseX: number;
    startMouseY: number;
    // Original item position
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    // Current computed values
    currentX: number;
    currentY: number;
    currentW: number;
    currentH: number;
}

// ─── Component ─────────────────────────────────────────────────
export default function DashboardGrid({ defaultLayouts, isLocked, storageKey, children }: DashboardGridProps) {
    const key = storageKey || DEFAULT_STORAGE_KEY;
    const containerRef = useRef<HTMLDivElement>(null);
    const [layouts, setLayouts] = useState<LayoutsMap>(() => {
        const saved = loadSavedLayouts(key);
        return saved || defaultLayouts;
    });
    const [containerWidth, setContainerWidth] = useState(0);

    // Drag-swap state
    const [dragState, setDragState] = useState<{
        draggingId: string | null;
        overId: string | null;
    }>({ draggingId: null, overId: null });

    // Resize state
    const [resizeState, setResizeState] = useState<ResizeState | null>(null);

    // Measure container width
    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver(entries => {
            for (const e of entries) setContainerWidth(e.contentRect.width);
        });
        obs.observe(containerRef.current);
        setContainerWidth(containerRef.current.offsetWidth);
        return () => obs.disconnect();
    }, []);

    const bp = getBreakpoint(containerWidth);
    const cols = getCols(bp);
    const gap = 12;
    const rowHeight = 42;
    const rawLayout = layouts[bp] || defaultLayouts[bp];
    const colWidth = containerWidth > 0 ? (containerWidth - gap * (cols - 1)) / cols : 0;

    // Build child map
    const childArray = Array.isArray(children) ? children : [children];
    const childMap: Record<string, React.ReactNode> = {};
    childArray.forEach((child: any) => {
        if (child?.key) childMap[child.key] = child;
    });

    // PERF: Filter layout to only items with visible children, then compact to fill gaps
    const visibleLayout = rawLayout.filter(item => !!childMap[item.i]);

    // Compact layout vertically after changes
    const compactLayout = useCallback((items: LayoutItem[]): LayoutItem[] => {
        const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
        const occupied: boolean[][] = [];

        const isOccupied = (x: number, y: number, w: number, h: number) => {
            for (let row = y; row < y + h; row++) {
                for (let col = x; col < x + w; col++) {
                    if (occupied[row]?.[col]) return true;
                }
            }
            return false;
        };

        const markOccupied = (x: number, y: number, w: number, h: number) => {
            for (let row = y; row < y + h; row++) {
                if (!occupied[row]) occupied[row] = [];
                for (let col = x; col < x + w; col++) {
                    occupied[row][col] = true;
                }
            }
        };

        return sorted.map(item => {
            let newY = 0;
            while (isOccupied(item.x, newY, item.w, item.h)) {
                newY++;
            }
            const newItem = { ...item, y: newY };
            markOccupied(newItem.x, newItem.y, newItem.w, newItem.h);
            return newItem;
        });
    }, []);

    // Active layout: only visible children, compacted to fill gaps
    const layout = compactLayout(visibleLayout);

    // ─── Drag & Drop (swap) Handlers ───────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setTimeout(() => setDragState(prev => ({ ...prev, draggingId: id })), 0);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragState(prev => prev.overId !== id ? { ...prev, overId: id } : prev);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragState(prev => ({ ...prev, overId: null }));
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (!sourceId || sourceId === targetId) {
            setDragState({ draggingId: null, overId: null });
            return;
        }

        setLayouts(prev => {
            const newLayouts = { ...prev };
            (['lg', 'md', 'sm'] as Breakpoint[]).forEach(breakpoint => {
                const items = [...newLayouts[breakpoint]];
                const srcIdx = items.findIndex(it => it.i === sourceId);
                const tgtIdx = items.findIndex(it => it.i === targetId);
                if (srcIdx >= 0 && tgtIdx >= 0) {
                    const srcPos = { x: items[srcIdx].x, y: items[srcIdx].y, w: items[srcIdx].w, h: items[srcIdx].h };
                    const tgtPos = { x: items[tgtIdx].x, y: items[tgtIdx].y, w: items[tgtIdx].w, h: items[tgtIdx].h };
                    items[srcIdx] = { ...items[srcIdx], ...tgtPos };
                    items[tgtIdx] = { ...items[tgtIdx], ...srcPos };
                    newLayouts[breakpoint] = items;
                }
            });
            saveLayoutsToStorage(key, newLayouts);
            return newLayouts;
        });
        setDragState({ draggingId: null, overId: null });
    }, []);

    const handleDragEnd = useCallback(() => {
        setDragState({ draggingId: null, overId: null });
    }, []);

    // ─── Resize Handlers (multi-direction) ─────────────────────
    const handleResizeStart = useCallback((e: React.MouseEvent, itemId: string, dir: ResizeDir) => {
        e.preventDefault();
        e.stopPropagation();
        const item = layout.find(it => it.i === itemId);
        if (!item) return;
        setResizeState({
            id: itemId,
            dir,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            origX: item.x,
            origY: item.y,
            origW: item.w,
            origH: item.h,
            currentX: item.x,
            currentY: item.y,
            currentW: item.w,
            currentH: item.h,
        });
    }, [layout]);

    useEffect(() => {
        if (!resizeState) return;

        const unitW = colWidth + gap;
        const unitH = rowHeight + gap;
        const { dir, startMouseX, startMouseY, origX, origY, origW, origH } = resizeState;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaColsRaw = (e.clientX - startMouseX) / unitW;
            const deltaRowsRaw = (e.clientY - startMouseY) / unitH;
            const deltaCols = Math.round(deltaColsRaw);
            const deltaRows = Math.round(deltaRowsRaw);

            let newX = origX, newY = origY, newW = origW, newH = origH;

            // East edge: increase width
            if (dir === 'e' || dir === 'se' || dir === 'ne') {
                newW = Math.max(1, origW + deltaCols);
                newW = Math.min(newW, cols - origX); // can't go past right edge
            }
            // West edge: move x left, increase width
            if (dir === 'w' || dir === 'sw' || dir === 'nw') {
                const shift = Math.min(deltaCols, origW - 1); // don't shrink below 1
                newX = Math.max(0, origX + shift);
                newW = origW - (newX - origX);
                newW = Math.max(1, newW);
            }
            // South edge: increase height
            if (dir === 's' || dir === 'se' || dir === 'sw') {
                newH = Math.max(1, origH + deltaRows);
            }
            // North edge: move y up, increase height
            if (dir === 'n' || dir === 'ne' || dir === 'nw') {
                const shift = Math.min(deltaRows, origH - 1); // don't shrink below 1
                newY = Math.max(0, origY + shift);
                newH = origH - (newY - origY);
                newH = Math.max(1, newH);
            }

            setResizeState(prev => prev ? { ...prev, currentX: newX, currentY: newY, currentW: newW, currentH: newH } : null);
        };

        const handleMouseUp = () => {
            if (!resizeState) return;
            setLayouts(prev => {
                const newLayouts = { ...prev };
                const items = [...newLayouts[bp]];
                const idx = items.findIndex(it => it.i === resizeState.id);
                if (idx >= 0) {
                    items[idx] = {
                        ...items[idx],
                        x: resizeState.currentX,
                        y: resizeState.currentY,
                        w: resizeState.currentW,
                        h: resizeState.currentH,
                    };
                    newLayouts[bp] = compactLayout(items);
                }
                saveLayoutsToStorage(key, newLayouts);
                return newLayouts;
            });
            setResizeState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizeState, bp, colWidth, cols, gap, rowHeight, compactLayout]);

    // ─── Calculate total height ────────────────────────────────
    let maxBottom = 0;
    layout.forEach(item => {
        const isThis = resizeState?.id === item.i;
        const h = isThis ? resizeState!.currentH : item.h;
        const y = isThis ? resizeState!.currentY : item.y;
        const bottom = y + h;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    const totalHeight = maxBottom * (rowHeight + gap);

    if (containerWidth === 0) {
        return <div ref={containerRef} className="w-full min-h-[200px]" />;
    }

    // Cursor map for resize directions
    const cursorMap: Record<ResizeDir, string> = {
        n: 'cursor-n-resize', s: 'cursor-s-resize',
        e: 'cursor-e-resize', w: 'cursor-w-resize',
        ne: 'cursor-ne-resize', nw: 'cursor-nw-resize',
        se: 'cursor-se-resize', sw: 'cursor-sw-resize',
    };

    return (
        <div
            ref={containerRef}
            className="w-full relative"
            style={{ height: totalHeight, userSelect: resizeState ? 'none' : undefined }}
        >
            {layout.map(item => {
                const child = childMap[item.i];
                if (!child) return null;

                const isResizing = resizeState?.id === item.i;
                const x = isResizing ? resizeState!.currentX : item.x;
                const y = isResizing ? resizeState!.currentY : item.y;
                const w = isResizing ? resizeState!.currentW : item.w;
                const h = isResizing ? resizeState!.currentH : item.h;

                const left = x * (colWidth + gap);
                const top = y * (rowHeight + gap);
                const width = w * colWidth + (w - 1) * gap;
                const height = h * rowHeight + (h - 1) * gap;
                const isDragging = dragState.draggingId === item.i;
                const isDragOver = dragState.overId === item.i && dragState.draggingId !== item.i;

                return (
                    <div
                        key={item.i}
                        className={`absolute ${isResizing ? '' : 'transition-all duration-300 ease-in-out'} ${isDragging ? 'opacity-40 scale-[0.97]' : ''
                            } ${isDragOver ? 'ring-2 ring-blue-400 ring-offset-2 rounded-lg' : ''} ${!isLocked ? 'outline outline-1 outline-dashed outline-blue-200/60 rounded-lg' : ''
                            }`}
                        style={{ left, top, width, height }}
                        onDragOver={!isLocked ? (e) => handleDragOver(e, item.i) : undefined}
                        onDragLeave={!isLocked ? handleDragLeave : undefined}
                        onDrop={!isLocked ? (e) => handleDrop(e, item.i) : undefined}
                    >
                        {/* Drag handle — top-right */}
                        {!isLocked && (
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.i)}
                                onDragEnd={handleDragEnd}
                                className="absolute top-1.5 right-1.5 z-30 cursor-grab active:cursor-grabbing p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-all hover:scale-110"
                                title="Drag to swap with another widget"
                            >
                                <GripVertical className="h-4 w-4" />
                            </div>
                        )}

                        {/* ── Edge & corner resize handles (visible dots) ── */}
                        {!isLocked && (<>
                            {/* ── Edge hit zones (wide invisible grab areas) ── */}
                            {/* Top edge */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'n')}
                                className={`absolute -top-1 left-3 right-3 z-20 ${cursorMap.n}`} style={{ height: 8 }} />
                            {/* Bottom edge */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 's')}
                                className={`absolute -bottom-1 left-3 right-3 z-20 ${cursorMap.s}`} style={{ height: 8 }} />
                            {/* Left edge */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'w')}
                                className={`absolute -left-1 top-3 bottom-3 z-20 ${cursorMap.w}`} style={{ width: 8 }} />
                            {/* Right edge */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'e')}
                                className={`absolute -right-1 top-3 bottom-3 z-20 ${cursorMap.e}`} style={{ width: 8 }} />

                            {/* ── Corner hit zones ── */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'nw')} className={`absolute -top-1.5 -left-1.5 z-20 w-4 h-4 ${cursorMap.nw}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'ne')} className={`absolute -top-1.5 -right-1.5 z-20 w-4 h-4 ${cursorMap.ne}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'sw')} className={`absolute -bottom-1.5 -left-1.5 z-20 w-4 h-4 ${cursorMap.sw}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'se')} className={`absolute -bottom-1.5 -right-1.5 z-20 w-4 h-4 ${cursorMap.se}`} />

                            {/* ── Visible dot indicators ── */}
                            {/* Edge midpoint dots */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'n')}
                                className={`absolute top-[-3px] left-1/2 -translate-x-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.n}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 's')}
                                className={`absolute bottom-[-3px] left-1/2 -translate-x-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.s}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'w')}
                                className={`absolute left-[-3px] top-1/2 -translate-y-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.w}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'e')}
                                className={`absolute right-[-3px] top-1/2 -translate-y-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.e}`} />
                            {/* Corner dots (slightly larger) */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'nw')}
                                className={`absolute top-[-4px] left-[-4px] z-20 w-2 h-2 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.nw}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'ne')}
                                className={`absolute top-[-4px] right-[-4px] z-20 w-2 h-2 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.ne}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'sw')}
                                className={`absolute bottom-[-4px] left-[-4px] z-20 w-2 h-2 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.sw}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'se')}
                                className={`absolute bottom-[-4px] right-[-4px] z-20 w-2 h-2 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.se}`} />
                        </>)}

                        <div className="grid-cell-content h-full w-full overflow-hidden rounded-lg">{child}</div>
                    </div>
                );
            })}

            {/* Resize preview ghost */}
            {resizeState && (() => {
                const gLeft = resizeState.currentX * (colWidth + gap);
                const gTop = resizeState.currentY * (rowHeight + gap);
                const gWidth = resizeState.currentW * colWidth + (resizeState.currentW - 1) * gap;
                const gHeight = resizeState.currentH * rowHeight + (resizeState.currentH - 1) * gap;
                return (
                    <div
                        className="absolute border-2 border-blue-400 border-dashed rounded-lg bg-blue-50/30 pointer-events-none z-10"
                        style={{ left: gLeft, top: gTop, width: gWidth, height: gHeight }}
                    >
                        <span className="absolute bottom-1 right-2 text-[10px] font-mono text-blue-500 bg-white/80 px-1 rounded">
                            {resizeState.currentW}×{resizeState.currentH}
                        </span>
                    </div>
                );
            })()}
        </div>
    );
}
