'use client';

import { productCategoryLabel, productCategoryStyle } from '@/lib/product-category';

interface ProductBadgeProps {
    /** jobs.product_category — the PRODUCT type (Label / Pouch / Box), not job_type. */
    category?: string | null;
    /** xs for dense rows inside a card, sm for card headers and detail panels. */
    size?: 'xs' | 'sm';
    className?: string;
}

/**
 * The one chip that says what a job or sheet actually is.
 *
 * Renders nothing when there is no category, so it can be dropped anywhere
 * without guarding at every call site. Colours come from lib/product-category
 * so LABEL is the same blue on the planner, the print run and the invoice.
 */
export default function ProductBadge({ category, size = 'xs', className = '' }: ProductBadgeProps) {
    const label = productCategoryLabel(category);
    if (!label) return null;

    const sizing = size === 'sm'
        ? 'text-[11px] px-2 py-0.5'
        : 'text-[9px] px-1.5 py-0.5';

    return (
        <span
            title={`Product type: ${label}`}
            className={`inline-flex items-center rounded border font-bold tracking-wide shrink-0 ${sizing} ${productCategoryStyle(category)} ${className}`}
        >
            {label}
        </span>
    );
}
