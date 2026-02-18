'use client';

import { useEffect, useState, useRef } from 'react';
import { GripVertical } from 'lucide-react';

// Types
type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
type LayoutsMap = { [breakpoint: string]: LayoutItem[] };

const LAYOUT_STORAGE_KEY = 'aayam-dashboard-layouts-v2';

interface DashboardGridProps {
    defaultLayouts: LayoutsMap;
    isLocked: boolean;
    children: React.ReactNode;
}

function loadSavedLayouts(): LayoutsMap | null {
    try {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch { }
    return null;
}

function saveLayoutsToStorage(layouts: LayoutsMap) {
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
    } catch { }
}

export function resetLayouts() {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
}

export default function DashboardGrid({ defaultLayouts, isLocked, children }: DashboardGridProps) {
    const [mounted, setMounted] = useState(false);
    const [layouts, setLayouts] = useState<LayoutsMap>(defaultLayouts);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        setMounted(true);
        const saved = loadSavedLayouts();
        if (saved) setLayouts(saved);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        setContainerWidth(containerRef.current.offsetWidth);
        return () => observer.disconnect();
    }, []);

    const handleLayoutChange = (_layout: LayoutItem[], allLayouts: LayoutsMap) => {
        setLayouts(allLayouts);
        saveLayoutsToStorage(allLayouts);
    };

    // Determine current breakpoint
    const getBreakpoint = (w: number) => {
        if (w >= 1024) return 'lg';
        if (w >= 768) return 'md';
        if (w >= 480) return 'sm';
        return 'xs';
    };

    if (!mounted || containerWidth === 0) {
        return (
            <div ref={containerRef} className="w-full">
                <div className="text-center py-12 text-muted-foreground text-sm">Loading dashboard layout...</div>
            </div>
        );
    }

    const bp = getBreakpoint(containerWidth);
    const currentLayout = layouts[bp] || defaultLayouts[bp] || defaultLayouts.lg;
    const cols = bp === 'lg' ? 12 : bp === 'md' ? 6 : 2;
    const gap = 12;
    const colWidth = (containerWidth - gap * (cols - 1)) / cols;
    const rowHeight = 40;

    // Sort children into a map by key
    const childArray = Array.isArray(children) ? children : [children];
    const childMap: Record<string, React.ReactNode> = {};
    childArray.forEach((child: any) => {
        if (child?.key) childMap[child.key] = child;
    });

    // For locked mode, use CSS grid for simplicity and performance
    if (isLocked) {
        // Calculate total height
        let maxY = 0;
        currentLayout.forEach(item => {
            const bottom = item.y + item.h;
            if (bottom > maxY) maxY = bottom;
        });

        return (
            <div ref={containerRef} className="w-full relative" style={{ height: maxY * (rowHeight + gap) - gap }}>
                {currentLayout.map(item => {
                    const child = childMap[item.i];
                    if (!child) return null;
                    const left = item.x * (colWidth + gap);
                    const top = item.y * (rowHeight + gap);
                    const width = item.w * colWidth + (item.w - 1) * gap;
                    const height = item.h * rowHeight + (item.h - 1) * gap;
                    return (
                        <div
                            key={item.i}
                            className="absolute transition-all duration-200"
                            style={{ left, top, width, height }}
                        >
                            <div className="h-full w-full overflow-hidden">{child}</div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Editing mode — use absolute positioned draggable items
    // For simplicity, we'll also use the same absolute positioning
    // but with visual indicators
    let maxY = 0;
    currentLayout.forEach(item => {
        const bottom = item.y + item.h;
        if (bottom > maxY) maxY = bottom;
    });

    return (
        <div ref={containerRef} className="w-full relative" style={{ height: maxY * (rowHeight + gap) - gap }}>
            {currentLayout.map(item => {
                const child = childMap[item.i];
                if (!child) return null;
                const left = item.x * (colWidth + gap);
                const top = item.y * (rowHeight + gap);
                const width = item.w * colWidth + (item.w - 1) * gap;
                const height = item.h * rowHeight + (item.h - 1) * gap;
                return (
                    <div
                        key={item.i}
                        className="absolute transition-all duration-200 ring-2 ring-blue-200 ring-offset-1 rounded-lg"
                        style={{ left, top, width, height }}
                    >
                        <div className="absolute top-1 right-1 z-10 p-1 rounded bg-blue-100/80 cursor-grab">
                            <GripVertical className="h-3 w-3 text-blue-500" />
                        </div>
                        <div className="h-full w-full overflow-hidden">{child}</div>
                    </div>
                );
            })}
        </div>
    );
}
