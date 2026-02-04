'use client';

import { useState, useEffect } from 'react';

/**
 * Hook for responsive behavior
 * Returns current breakpoint and helper booleans
 */
export function useResponsive(breakpoint = 768) {
    const [width, setWidth] = useState<number>(
        typeof window !== 'undefined' ? window.innerWidth : 1024
    );

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        width,
        isMobile: width < breakpoint,
        isTablet: width >= breakpoint && width < 1024,
        isDesktop: width >= 1024,
        isLargeDesktop: width >= 1280,
    };
}

/**
 * Hook for collapsible section state
 */
export function useCollapsible(defaultExpanded = true) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const toggle = () => setIsExpanded(!isExpanded);
    const expand = () => setIsExpanded(true);
    const collapse = () => setIsExpanded(false);

    return {
        isExpanded,
        toggle,
        expand,
        collapse,
    };
}

/**
 * Hook for managing selected items
 */
export function useSelection<T>(keyExtractor: (item: T) => string) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleItem = (item: T) => {
        const id = keyExtractor(item);
        const newSet = new Set(selectedIds);

        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }

        setSelectedIds(newSet);
    };

    const selectAll = (items: T[]) => {
        setSelectedIds(new Set(items.map(keyExtractor)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const isSelected = (item: T) => {
        return selectedIds.has(keyExtractor(item));
    };

    return {
        selectedIds,
        toggleItem,
        selectAll,
        clearSelection,
        isSelected,
        selectedCount: selectedIds.size,
    };
}
