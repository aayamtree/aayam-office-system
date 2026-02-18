'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { GripVertical } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
type LayoutItem = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
type LayoutsMap = { [breakpoint: string]: LayoutItem[] };

const LAYOUT_STORAGE_KEY = 'aayam-dashboard-layouts-v2';

// ─── Persistence ───────────────────────────────────────────────
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

// ─── Props ─────────────────────────────────────────────────────
interface DashboardGridProps {
    defaultLayouts: LayoutsMap;
    isLocked: boolean;
    children: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────
export default function DashboardGrid({ defaultLayouts, isLocked, children }: DashboardGridProps) {
    const [mounted, setMounted] = useState(false);
    const [layouts, setLayouts] = useState<LayoutsMap>(defaultLayouts);
    // eslint-disable-next-line
    const [GridComponent, setGridComponent] = useState<any>(null);

    useEffect(() => {
        setMounted(true);
        const saved = loadSavedLayouts();
        if (saved) setLayouts(saved);

        // Dynamically load react-grid-layout on client only
        import('react-grid-layout').then((mod: any) => {
            const Responsive = mod.Responsive || mod.default?.Responsive;
            const WidthProvider = mod.WidthProvider || mod.default?.WidthProvider;
            if (Responsive && WidthProvider) {
                setGridComponent(() => WidthProvider(Responsive));
            }
        });
    }, []);

    const handleLayoutChange = (_currentLayout: any[], allLayouts: LayoutsMap) => {
        setLayouts(allLayouts);
        saveLayoutsToStorage(allLayouts);
    };

    // Wrap each child with a drag-handle indicator when editing
    const wrappedChildren = useMemo(() => {
        const childArray = Array.isArray(children) ? children : [children];
        return childArray.map((child: any) => {
            if (!child?.key) return child;
            return (
                <div key={child.key} className="relative h-full">
                    {!isLocked && (
                        <div className="drag-handle absolute top-1 right-1 z-20 cursor-grab active:cursor-grabbing p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white shadow-md transition-colors">
                            <GripVertical className="h-4 w-4" />
                        </div>
                    )}
                    <div className="h-full w-full overflow-hidden">
                        {child}
                    </div>
                </div>
            );
        });
    }, [children, isLocked]);

    if (!mounted || !GridComponent) {
        return <div className="text-center py-12 text-muted-foreground text-sm">Loading dashboard...</div>;
    }

    const RGL = GridComponent;

    return (
        <>
            <style jsx global>{`
                .react-grid-layout {
                    position: relative;
                    transition: height 200ms ease;
                }
                .react-grid-item {
                    transition: all 200ms ease;
                    transition-property: left, top, width, height;
                }
                .react-grid-item.cssTransforms {
                    transition-property: transform, width, height;
                }
                .react-grid-item.resizing {
                    transition: none;
                    z-index: 1;
                    will-change: width, height;
                }
                .react-grid-item.react-draggable-dragging {
                    transition: none;
                    z-index: 3;
                    will-change: transform;
                    opacity: 0.92;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.18);
                    border-radius: 8px;
                }
                .react-grid-item > .react-resizable-handle {
                    position: absolute;
                    width: 20px;
                    height: 20px;
                }
                .react-grid-item > .react-resizable-handle::after {
                    content: "";
                    position: absolute;
                    right: 4px;
                    bottom: 4px;
                    width: 8px;
                    height: 8px;
                    border-right: 2px solid rgba(59, 130, 246, 0.5);
                    border-bottom: 2px solid rgba(59, 130, 246, 0.5);
                }
                .react-resizable-handle-se {
                    bottom: 0;
                    right: 0;
                    cursor: se-resize;
                }
                .react-grid-item.react-grid-placeholder {
                    background: rgba(59, 130, 246, 0.12);
                    border: 2px dashed rgba(59, 130, 246, 0.35);
                    border-radius: 8px;
                    opacity: 1;
                    transition-duration: 100ms;
                    z-index: 2;
                }
                .dashboard-editing .react-grid-item {
                    outline: 2px dashed rgba(59, 130, 246, 0.2);
                    outline-offset: -1px;
                    border-radius: 8px;
                }
                .dashboard-editing .react-grid-item:hover {
                    outline-color: rgba(59, 130, 246, 0.45);
                }
            `}</style>

            <div className={!isLocked ? 'dashboard-editing' : ''}>
                <RGL
                    className="layout"
                    layouts={layouts}
                    breakpoints={{ lg: 1024, md: 768, sm: 480, xs: 0 }}
                    cols={{ lg: 12, md: 6, sm: 2, xs: 2 }}
                    rowHeight={40}
                    onLayoutChange={handleLayoutChange}
                    isDraggable={!isLocked}
                    isResizable={!isLocked}
                    draggableHandle=".drag-handle"
                    containerPadding={[0, 0]}
                    margin={[12, 12]}
                    useCSSTransforms={true}
                    compactType="vertical"
                >
                    {wrappedChildren}
                </RGL>
            </div>
        </>
    );
}
