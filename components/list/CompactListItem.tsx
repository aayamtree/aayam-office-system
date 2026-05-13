'use client';

import { ReactNode } from 'react';

interface CompactListItemProps {
    /** Primary title */
    title: string;

    /** Secondary subtitle */
    subtitle?: string;

    /** Metadata line (bottom) */
    metadata?: ReactNode;

    /** Badge/tag on the right */
    badge?: ReactNode;

    /** Checkbox for selection */
    showCheckbox?: boolean;

    /** Checked state */
    checked?: boolean;

    /** Checkbox change handler */
    onCheckChange?: (checked: boolean) => void;

    /** Click handler for entire item */
    onClick?: () => void;

    /** Additional CSS classes */
    className?: string;
}

/**
 * Compact List Item Component (Mobile)
 * 
 * Used for mobile list views with 2-3 line layout
 * Follows design guidelines:
 * - 14px font-size, 500 weight for title
 * - 13px for subtitle, 12px for metadata
 * - 12px padding vertical, 16px horizontal
 * - Min-height: 70px
 * - Border-bottom divider
 */
export function CompactListItem({
    title,
    subtitle,
    metadata,
    badge,
    showCheckbox = false,
    checked = false,
    onCheckChange,
    onClick,
    className = '',
}: CompactListItemProps) {
    return (
        <div
            onClick={onClick}
            className={`list-item flex items-start gap-3 py-3 px-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 cursor-pointer min-h-[70px] ${className}`}
        >
            {/* Checkbox (optional) */}
            {showCheckbox && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                >
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onCheckChange?.(e.target.checked)}
                        className="w-[18px] h-[18px] rounded border-2 border-gray-300 text-[#0000FF] focus:ring-2 focus:ring-[#0000FF] focus:ring-offset-0 cursor-pointer"
                    />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="text-sm font-medium text-gray-900 mb-1 leading-snug">
                    {title}
                </div>

                {/* Subtitle */}
                {subtitle && (
                    <div className="text-[13px] text-gray-600 mb-1 leading-snug">
                        {subtitle}
                    </div>
                )}

                {/* Metadata */}
                {metadata && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {metadata}
                    </div>
                )}
            </div>

            {/* Badge (right side) */}
            {badge && (
                <div className="flex-shrink-0 self-start">
                    {badge}
                </div>
            )}
        </div>
    );
}
