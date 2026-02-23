'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GripVertical, Maximize2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
export type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
export type LayoutsMap = { lg: LayoutItem[]; md: LayoutItem[]; sm: LayoutItem[] };

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const DEFAULT_STORAGE_KEY = 'aayam-dashboard-layouts-v4';

// ─── Size presets (grid units: w × h) ──────────────────────────
const SIZE_PRESETS = [
    { label: 'S', w: 3, h: 2, title: 'Small (3×2)' },
    { label: 'M', w: 4, h: 4, title: 'Medium (4×4)' },
    { label: 'L', w: 6, h: 5, title: 'Large (6×5)' },
    { label: 'W', w: 6, h: 3, title: 'Wide (6×3)' },
    { label: 'XL', w: 12, h: 6, title: 'Full Width (12×6)' },
];

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

// ─── Drag state (free-position) ────────────────────────────────
interface DragState {
    id: string;
    startMouseX: number;
    startMouseY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    // Target grid position (where ghost shows)
    targetX: number;
    targetY: number;
}

// ─── Resize state ──────────────────────────────────────────────
interface ResizeState {
    id: string;
    dir: ResizeDir;
    startMouseX: number;
    startMouseY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
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

    // Drag state (free-position mouse-based)
    const [dragState, setDragState] = useState<DragState | null>(null);

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

    // Filter layout to only items with visible children
    const visibleLayout = rawLayout.filter(item => !!childMap[item.i]);

    // Compact layout vertically to fill gaps
    const compactLayout = useCallback((items: LayoutItem[]): LayoutItem[] => {
        const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
        const occupied: boolean[][] = [];

        const isOccupied = (x: number, y: number, w: number, h: number, skipId?: string) => {
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

    // Active layout: compacted
    const layout = compactLayout(visibleLayout);

    // Apply a preset size
    const applyPresetSize = useCallback((itemId: string, newW: number, newH: number) => {
        setLayouts(prev => {
            const newLayouts = { ...prev };
            (['lg', 'md', 'sm'] as Breakpoint[]).forEach(breakpoint => {
                const bpCols = getCols(breakpoint);
                const items = [...newLayouts[breakpoint]];
                const idx = items.findIndex(it => it.i === itemId);
                if (idx >= 0) {
                    const clampedW = Math.min(newW, bpCols);
                    const clampedX = Math.min(items[idx].x, bpCols - clampedW);
                    items[idx] = { ...items[idx], w: clampedW, h: newH, x: clampedX };
                    newLayouts[breakpoint] = compactLayout(items);
                }
            });
            saveLayoutsToStorage(key, newLayouts);
            return newLayouts;
        });
    }, [compactLayout, key]);

    // ─── Free-Position Drag Handlers ───────────────────────────
    const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const item = layout.find(it => it.i === id);
        if (!item) return;
        setDragState({
            id,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            origX: item.x,
            origY: item.y,
            origW: item.w,
            origH: item.h,
            targetX: item.x,
            targetY: item.y,
        });
    }, [layout]);

    // Mouse move/up for free-position drag
    useEffect(() => {
        if (!dragState) return;

        const unitW = colWidth + gap;
        const unitH = rowHeight + gap;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragState.startMouseX;
            const deltaY = e.clientY - dragState.startMouseY;

            // Calculate target grid position
            let targetX = dragState.origX + Math.round(deltaX / unitW);
            let targetY = dragState.origY + Math.round(deltaY / unitH);

            // Clamp to grid bounds
            targetX = Math.max(0, Math.min(targetX, cols - dragState.origW));
            targetY = Math.max(0, targetY);

            setDragState(prev => prev ? { ...prev, targetX, targetY } : null);
        };

        const handleMouseUp = () => {
            if (!dragState) return;

            setLayouts(prev => {
                const newLayouts = { ...prev };
                const items = [...newLayouts[bp]];
                const idx = items.findIndex(it => it.i === dragState.id);
                if (idx >= 0) {
                    // Place dragged item at target position
                    items[idx] = { ...items[idx], x: dragState.targetX, y: dragState.targetY };

                    // Resolve collisions: push overlapping items down
                    const resolved = resolveCollisions(items, dragState.id, cols);
                    newLayouts[bp] = compactLayout(resolved);
                }
                saveLayoutsToStorage(key, newLayouts);
                return newLayouts;
            });
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, bp, colWidth, cols, gap, rowHeight, compactLayout, key]);

    // ─── Collision Resolution ──────────────────────────────────
    // After placing a widget, push any overlapping widgets downward
    function resolveCollisions(items: LayoutItem[], movedId: string, gridCols: number): LayoutItem[] {
        const result = [...items];
        const movedIdx = result.findIndex(it => it.i === movedId);
        if (movedIdx < 0) return result;
        const moved = result[movedIdx];

        for (let i = 0; i < result.length; i++) {
            if (i === movedIdx) continue;
            const other = result[i];

            // Check overlap
            const overlapX = moved.x < other.x + other.w && moved.x + moved.w > other.x;
            const overlapY = moved.y < other.y + other.h && moved.y + moved.h > other.y;

            if (overlapX && overlapY) {
                // Push the other widget below the moved widget
                result[i] = { ...other, y: moved.y + moved.h };
            }
        }
        return result;
    }

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

            if (dir === 'e' || dir === 'se' || dir === 'ne') {
                newW = Math.max(1, origW + deltaCols);
                newW = Math.min(newW, cols - origX);
            }
            if (dir === 'w' || dir === 'sw' || dir === 'nw') {
                const shift = Math.min(deltaCols, origW - 1);
                newX = Math.max(0, origX + shift);
                newW = origW - (newX - origX);
                newW = Math.max(1, newW);
            }
            if (dir === 's' || dir === 'se' || dir === 'sw') {
                newH = Math.max(1, origH + deltaRows);
            }
            if (dir === 'n' || dir === 'ne' || dir === 'nw') {
                const shift = Math.min(deltaRows, origH - 1);
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
    }, [resizeState, bp, colWidth, cols, gap, rowHeight, compactLayout, key]);

    // ─── Calculate total height ────────────────────────────────
    let maxBottom = 0;
    layout.forEach(item => {
        const isResizingThis = resizeState?.id === item.i;
        const isDraggingThis = dragState?.id === item.i;
        const h = isResizingThis ? resizeState!.currentH : item.h;
        const y = isResizingThis ? resizeState!.currentY : isDraggingThis ? dragState!.targetY : item.y;
        const bottom = y + h;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    // Add extra rows when dragging to allow dropping below all content
    if (dragState) maxBottom += 4;
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
            style={{ height: totalHeight, userSelect: (resizeState || dragState) ? 'none' : undefined }}
        >
            {/* Grid background lines when unlocked (shows drop zones) */}
            {!isLocked && (
                <div className="absolute inset-0 pointer-events-none z-0" style={{ height: totalHeight }}>
                    {Array.from({ length: Math.ceil(totalHeight / (rowHeight + gap)) }).map((_, row) => (
                        Array.from({ length: cols }).map((_, col) => {
                            const left = col * (colWidth + gap);
                            const top = row * (rowHeight + gap);
                            return (
                                <div
                                    key={`grid-${row}-${col}`}
                                    className="absolute border border-dashed border-gray-200/50 rounded"
                                    style={{ left, top, width: colWidth, height: rowHeight }}
                                />
                            );
                        })
                    ))}
                </div>
            )}

            {/* Drag target ghost (shows where widget will land) */}
            {dragState && (() => {
                const gLeft = dragState.targetX * (colWidth + gap);
                const gTop = dragState.targetY * (rowHeight + gap);
                const gWidth = dragState.origW * colWidth + (dragState.origW - 1) * gap;
                const gHeight = dragState.origH * rowHeight + (dragState.origH - 1) * gap;
                return (
                    <div
                        className="absolute border-2 border-blue-400 border-dashed rounded-lg bg-blue-100/40 pointer-events-none z-10 transition-all duration-100"
                        style={{ left: gLeft, top: gTop, width: gWidth, height: gHeight }}
                    >
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-blue-500 bg-white/80 px-2 py-0.5 rounded">
                            Drop here
                        </span>
                    </div>
                );
            })()}

            {layout.map(item => {
                const child = childMap[item.i];
                if (!child) return null;

                const isResizing = resizeState?.id === item.i;
                const isDragging = dragState?.id === item.i;

                // Position: use resize override, or normal position
                const x = isResizing ? resizeState!.currentX : item.x;
                const y = isResizing ? resizeState!.currentY : item.y;
                const w = isResizing ? resizeState!.currentW : item.w;
                const h = isResizing ? resizeState!.currentH : item.h;

                const left = x * (colWidth + gap);
                const top = y * (rowHeight + gap);
                const width = w * colWidth + (w - 1) * gap;
                const height = h * rowHeight + (h - 1) * gap;

                return (
                    <div
                        key={item.i}
                        className={`absolute ${isResizing ? '' : 'transition-all duration-300 ease-in-out'
                            } ${isDragging ? 'opacity-30 scale-[0.97] pointer-events-none' : ''
                            } ${!isLocked && !isDragging ? 'outline outline-1 outline-dashed outline-blue-200/60 rounded-lg' : ''
                            }`}
                        style={{ left, top, width, height, zIndex: isDragging ? 5 : undefined }}
                    >
                        {/* Drag handle — top-right */}
                        {!isLocked && (
                            <div
                                onMouseDown={(e) => handleDragStart(e, item.i)}
                                className="absolute top-1.5 right-1.5 z-30 cursor-grab active:cursor-grabbing p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-all hover:scale-110"
                                title="Drag to move widget"
                            >
                                <GripVertical className="h-4 w-4" />
                            </div>
                        )}

                        {/* Size preset buttons — bottom-left */}
                        {!isLocked && (
                            <div className="absolute bottom-1.5 left-1.5 z-30 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm rounded-md shadow-md border border-gray-200 px-1 py-0.5">
                                <Maximize2 className="h-3 w-3 text-gray-400 mr-0.5" />
                                {SIZE_PRESETS.map(preset => (
                                    <button
                                        key={preset.label}
                                        onClick={(e) => { e.stopPropagation(); applyPresetSize(item.i, preset.w, preset.h); }}
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${item.w === preset.w && item.h === preset.h
                                            ? 'bg-blue-500 text-white'
                                            : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                                            }`}
                                        title={preset.title}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ── Edge & corner resize handles ── */}
                        {!isLocked && (<>
                            {/* Edge hit zones */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'n')}
                                className={`absolute -top-1 left-3 right-3 z-20 ${cursorMap.n}`} style={{ height: 8 }} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 's')}
                                className={`absolute -bottom-1 left-3 right-3 z-20 ${cursorMap.s}`} style={{ height: 8 }} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'w')}
                                className={`absolute -left-1 top-3 bottom-3 z-20 ${cursorMap.w}`} style={{ width: 8 }} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'e')}
                                className={`absolute -right-1 top-3 bottom-3 z-20 ${cursorMap.e}`} style={{ width: 8 }} />

                            {/* Corner hit zones */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'nw')} className={`absolute -top-1.5 -left-1.5 z-20 w-4 h-4 ${cursorMap.nw}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'ne')} className={`absolute -top-1.5 -right-1.5 z-20 w-4 h-4 ${cursorMap.ne}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'sw')} className={`absolute -bottom-1.5 -left-1.5 z-20 w-4 h-4 ${cursorMap.sw}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'se')} className={`absolute -bottom-1.5 -right-1.5 z-20 w-4 h-4 ${cursorMap.se}`} />

                            {/* Visible dot indicators */}
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'n')}
                                className={`absolute top-[-3px] left-1/2 -translate-x-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.n}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 's')}
                                className={`absolute bottom-[-3px] left-1/2 -translate-x-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.s}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'w')}
                                className={`absolute left-[-3px] top-1/2 -translate-y-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.w}`} />
                            <div onMouseDown={(e) => handleResizeStart(e, item.i, 'e')}
                                className={`absolute right-[-3px] top-1/2 -translate-y-1/2 z-20 w-1.5 h-1.5 rounded-full bg-blue-400 hover:bg-blue-600 hover:scale-150 transition-all ${cursorMap.e}`} />
                            {/* Corner dots */}
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
