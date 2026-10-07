import * as React from 'react';

/**
 * ScrollList — the ONLY way a list of unknown length may sit inside a card.
 *
 * Why this exists (2026-10-07): the dashboard calendar listed every item for
 * the selected day. One busy day had ~100 dispatches, the card grew to
 * ~3000px, and because a grid row is as tall as its tallest card, Monthly
 * revenue and Team workload were stretched with it. The same fault as the
 * "Quick Notes scrolling" bug of 2026-09-14.
 *
 * Rule: a card never grows with its data. A list that can grow goes inside
 * <ScrollList>, which caps its height and scrolls inside the card.
 *
 * Sizes are fixed class names (not computed) so Tailwind keeps them.
 */
const SIZES = {
    sm: 'max-h-44',   // ~3 rows
    md: 'max-h-64',   // ~5 rows
    lg: 'max-h-80',   // ~7 rows
} as const;

export interface ScrollListProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: keyof typeof SIZES;
}

export function ScrollList({ size = 'md', className = '', children, ...rest }: ScrollListProps) {
    return (
        <div
            {...rest}
            className={`${SIZES[size]} overflow-y-auto overscroll-contain pr-1 ${className}`}
        >
            {children}
        </div>
    );
}

export default ScrollList;
