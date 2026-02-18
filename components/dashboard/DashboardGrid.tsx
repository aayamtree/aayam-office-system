'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GripVertical, Maximize2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
export type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
export type LayoutsMap = { lg: LayoutItem[]; md: LayoutItem[]; sm: LayoutItem[] };

const LAYOUT_STORAGE_KEY = 'aayam-dashboard-layouts-v3';

// ─── Persistence ───────────────────────────────────────────────
function loadSavedLayouts(): LayoutsMap | null {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return null;
}

function saveLayoutsToStorage(layouts: LayoutsMap) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
    } catch { }
}

export function resetLayouts() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
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
    children: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────
export default function DashboardGrid({ defaultLayouts, isLocked, children }: DashboardGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [layouts, setLayouts] = useState<LayoutsMap>(() => {
        const saved = loadSavedLayouts();
        return saved || defaultLayouts;
    });
    const [containerWidth, setContainerWidth] = useState(0);

    // Drag-swap state
    const [dragState, setDragState] = useState<{
        draggingId: string | null;
        overId: string | null;
    }>({ draggingId: null, overId: null });

    // Resize state
    const [resizeState, setResizeState] = useState<{
        id: string;
        startX: number;
        startY: number;
        startW: number;
        startH: number;
        currentW: number;
        currentH: number;
    } | null>(null);

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
    const layout = layouts[bp] || defaultLayouts[bp];
    const colWidth = containerWidth > 0 ? (containerWidth - gap * (cols - 1)) / cols : 0;

    // Build child map
    const childArray = Array.isArray(children) ? children : [children];
    const childMap: Record<string, React.ReactNode> = {};
    childArray.forEach((child: any) => {
        if (child?.key) childMap[child.key] = child;
    });

    // Compact layout vertically after changes (push items up to fill gaps)
    const compactLayout = useCallback((items: LayoutItem[], totalCols: number): LayoutItem[] => {
        const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
        const occupied: boolean[][] = [];

        const isOccupied = (x: number, y: number, w: number, h: number, excludeI: string) => {
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
            // Try to push item up as far as possible
            let newY = 0;
            while (isOccupied(item.x, newY, item.w, item.h, item.i)) {
                newY++;
            }
            const newItem = { ...item, y: newY };
            markOccupied(newItem.x, newItem.y, newItem.w, newItem.h);
            return newItem;
        });
    }, []);

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
            saveLayoutsToStorage(newLayouts);
            return newLayouts;
        });
        setDragState({ draggingId: null, overId: null });
    }, []);

    const handleDragEnd = useCallback(() => {
        setDragState({ draggingId: null, overId: null });
    }, []);

    // ─── Resize Handlers ───────────────────────────────────────
    const handleResizeStart = useCallback((e: React.MouseEvent, itemId: string, itemW: number, itemH: number) => {
        e.preventDefault();
        e.stopPropagation();
        setResizeState({
            id: itemId,
            startX: e.clientX,
            startY: e.clientY,
            startW: itemW,
            startH: itemH,
            currentW: itemW,
            currentH: itemH,
        });
    }, []);

    useEffect(() => {
        if (!resizeState) return;

        const unitW = colWidth + gap;
        const unitH = rowHeight + gap;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeState.startX;
            const deltaY = e.clientY - resizeState.startY;

            // Convert pixel deltas to grid units
            const newW = Math.max(1, Math.min(cols, Math.round(resizeState.startW + deltaX / unitW)));
            const newH = Math.max(1, Math.round(resizeState.startH + deltaY / unitH));

            // Clamp width to not exceed cols
            const item = layout.find(it => it.i === resizeState.id);
            const maxW = item ? cols - item.x : cols;
            const clampedW = Math.min(newW, maxW);

            setResizeState(prev => prev ? { ...prev, currentW: clampedW, currentH: newH } : null);
        };

        const handleMouseUp = () => {
            if (!resizeState) return;
            setLayouts(prev => {
                const newLayouts = { ...prev };
                const items = [...newLayouts[bp]];
                const idx = items.findIndex(it => it.i === resizeState.id);
                if (idx >= 0) {
                    items[idx] = { ...items[idx], w: resizeState.currentW, h: resizeState.currentH };
                    newLayouts[bp] = compactLayout(items, cols);
                }
                saveLayoutsToStorage(newLayouts);
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
    }, [resizeState, bp, colWidth, cols, gap, rowHeight, layout, compactLayout]);

    // ─── Calculate total height ────────────────────────────────
    let maxBottom = 0;
    layout.forEach(item => {
        const h = resizeState?.id === item.i ? resizeState.currentH : item.h;
        const bottom = item.y + h;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    const totalHeight = maxBottom * (rowHeight + gap);

    if (containerWidth === 0) {
        return <div ref={containerRef} className="w-full min-h-[200px]" />;
    }

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
                const w = isResizing ? resizeState!.currentW : item.w;
                const h = isResizing ? resizeState!.currentH : item.h;

                const left = item.x * (colWidth + gap);
                const top = item.y * (rowHeight + gap);
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
                                className="absolute top-1.5 right-1.5 z-20 cursor-grab active:cursor-grabbing p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-all hover:scale-110"
                                title="Drag to swap with another widget"
                            >
                                <GripVertical className="h-4 w-4" />
                            </div>
                        )}

                        {/* Resize handle — bottom-right corner */}
                        {!isLocked && (
                            <div
                                onMouseDown={(e) => handleResizeStart(e, item.i, item.w, item.h)}
                                className="absolute bottom-0 right-0 z-20 w-5 h-5 cursor-se-resize group"
                                title="Drag to resize"
                            >
                                <Maximize2 className="absolute bottom-1 right-1 h-3 w-3 text-blue-400 group-hover:text-blue-600 rotate-90 transition-colors" />
                            </div>
                        )}

                        <div className="h-full w-full overflow-hidden rounded-lg">{child}</div>
                    </div>
                );
            })}

            {/* Resize preview ghost */}
            {resizeState && (() => {
                const item = layout.find(it => it.i === resizeState.id);
                if (!item) return null;
                const gLeft = item.x * (colWidth + gap);
                const gTop = item.y * (rowHeight + gap);
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
