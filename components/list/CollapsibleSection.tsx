'use client';

import { ReactNode } from 'react';
import { ChevronDown, ChevronRight, MoreVertical } from 'lucide-react';
import { useCollapsible } from './hooks';

interface CollapsibleSectionProps {
    /** Section title */
    title: string;

    /** Item count */
    count: number;

    /** Default expanded state */
    defaultExpanded?: boolean;

    /** Urgency level for badge color */
    urgency?: 'normal' | 'warning' | 'danger';

    /** Section content */
    children: ReactNode;

    /** Custom icon */
    icon?: ReactNode;

    /** Section menu/actions */
    actions?: ReactNode;

    /** Additional CSS classes */
    className?: string;
}

/**
 * Collapsible Section Component
 * 
 * Used for grouping list items with expandable/collapsible header
 * Follows design guidelines:
 * - 16px font-size, 600 weight for header
 * - 12px padding vertical, 16px horizontal
 * - Smooth transition (300ms)
 * - Count badge with urgency colors
 */
export function CollapsibleSection({
    title,
    count,
    defaultExpanded = true,
    urgency = 'normal',
    children,
    icon,
    actions,
    className = '',
}: CollapsibleSectionProps) {
    const { isExpanded, toggle } = useCollapsible(defaultExpanded);

    // Determine badge color based on urgency
    const badgeClasses = {
        normal: 'bg-gray-100 text-gray-700',
        warning: 'bg-amber-100 text-amber-700',
        danger: 'bg-red-100 text-red-700',
    }[urgency];

    return (
        <div className={`section ${className}`}>
            {/* Section Header */}
            <div
                onClick={toggle}
                className="section-header flex items-center justify-between py-3 px-4 bg-white border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
            >
                {/* Left side: Chevron + Icon + Title + Count */}
                <div className="flex items-center gap-2">
                    {/* Chevron */}
                    <div className="text-gray-500 transition-transform duration-200">
                        {isExpanded ? (
                            <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                        ) : (
                            <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                        )}
                    </div>

                    {/* Optional custom icon */}
                    {icon && <div className="text-gray-600">{icon}</div>}

                    {/* Title */}
                    <h3 className="text-base font-semibold text-gray-800">{title}</h3>

                    {/* Count badge */}
                    <span
                        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-2 text-xs font-bold rounded-full ${badgeClasses}`}
                    >
                        {count}
                    </span>
                </div>

                {/* Right side: Actions */}
                {actions && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2"
                    >
                        {actions}
                    </div>
                )}

                {/* Default menu icon if no actions provided */}
                {!actions && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // Handle menu click
                        }}
                        className="p-1 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        <MoreVertical className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-gray-500" />
                    </button>
                )}
            </div>

            {/* Section Content */}
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="bg-white">{children}</div>
            </div>
        </div>
    );
}
