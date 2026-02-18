'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

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
    const [dragState, setDragState] = useState<{
        draggingId: string | null;
        overId: string | null;
    }>({ draggingId: null, overId: null });

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

    // Build child map
    const childArray = Array.isArray(children) ? children : [children];
    const childMap: Record<string, React.ReactNode> = {};
    childArray.forEach((child: any) => {
        if (child?.key) childMap[child.key] = child;
    });

    // Calculate positions
    const colWidth = containerWidth > 0 ? (containerWidth - gap * (cols - 1)) / cols : 0;

    let maxBottom = 0;
    layout.forEach(item => {
        const bottom = item.y + item.h;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    const totalHeight = maxBottom * (rowHeight + gap);

    // ─── Drag & Drop Handlers ──────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        // Small delay so the drag image renders
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

        // Swap positions of source and target items
        setLayouts(prev => {
            const newLayouts = { ...prev };
            (['lg', 'md', 'sm'] as Breakpoint[]).forEach(breakpoint => {
                const items = [...newLayouts[breakpoint]];
                const srcIdx = items.findIndex(it => it.i === sourceId);
                const tgtIdx = items.findIndex(it => it.i === targetId);
                if (srcIdx >= 0 && tgtIdx >= 0) {
                    // Swap x, y, w, h
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

    if (containerWidth === 0) {
        return <div ref={containerRef} className="w-full min-h-[200px]" />;
    }

    return (
        <div ref={containerRef} className="w-full relative" style={{ height: totalHeight }}>
            {layout.map(item => {
                const child = childMap[item.i];
                if (!child) return null;

                const left = item.x * (colWidth + gap);
                const top = item.y * (rowHeight + gap);
                const width = item.w * colWidth + (item.w - 1) * gap;
                const height = item.h * rowHeight + (item.h - 1) * gap;
                const isDragging = dragState.draggingId === item.i;
                const isDragOver = dragState.overId === item.i && dragState.draggingId !== item.i;

                return (
                    <div
                        key={item.i}
                        className={`absolute transition-all duration-300 ease-in-out ${isDragging ? 'opacity-40 scale-95' : ''
                            } ${isDragOver ? 'ring-2 ring-blue-400 ring-offset-2 rounded-lg' : ''} ${!isLocked ? 'outline outline-1 outline-dashed outline-blue-200 rounded-lg' : ''
                            }`}
                        style={{ left, top, width, height }}
                        onDragOver={!isLocked ? (e) => handleDragOver(e, item.i) : undefined}
                        onDragLeave={!isLocked ? handleDragLeave : undefined}
                        onDrop={!isLocked ? (e) => handleDrop(e, item.i) : undefined}
                    >
                        {/* Drag handle */}
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
                        <div className="h-full w-full overflow-hidden">{child}</div>
                    </div>
                );
            })}
        </div>
    );
}
