'use client';

import { ReactNode } from 'react';

interface StatusBadgeProps {
    /** Status label */
    label: string;

    /** Status variant */
    variant?: 'new' | 'active' | 'warning' | 'urgent' | 'done' | 'cancelled';

    /** Custom color classes */
    className?: string;
}

/**
 * Status Badge Component
 * 
 * Colored pill badges for status display
 * Follows design guidelines:
 * - 11px font-size, 600 weight
 * - 4px vertical padding, 10px horizontal
 * - 12px border-radius (pill shape)
 */
export function StatusBadge({ label, variant = 'new', className = '' }: StatusBadgeProps) {
    const variantClasses = {
        new: 'bg-blue-100 text-blue-700',
        active: 'bg-green-100 text-green-700',
        warning: 'bg-amber-100 text-amber-700',
        urgent: 'bg-red-100 text-red-700',
        done: 'bg-gray-100 text-gray-600',
        cancelled: 'bg-gray-50 text-gray-400',
    }[variant];

    return (
        <span
            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-md ${variantClasses} ${className}`}
        >
            {label}
        </span>
    );
}

interface CountBadgeProps {
    /** Count value */
    count: number;

    /** Badge color variant */
    variant?: 'primary' | 'warning' | 'danger';
}

/**
 * Count Badge Component
 * 
 * Small circular badge for counts
 * Follows design guidelines:
 * - 11px font-size, 700 weight
 * - min-width: 20px, height: 20px
 * - Circular shape
 */
export function CountBadge({ count, variant = 'primary' }: CountBadgeProps) {
    const variantClasses = {
        primary: 'bg-oms-orange text-white',
        warning: 'bg-amber-500 text-white',
        danger: 'bg-red-500 text-white',
    }[variant];

    return (
        <span
            className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-md ${variantClasses}`}
        >
            {count}
        </span>
    );
}

interface TagBadgeProps {
    /** Tag label */
    label: string;

    /** Tag color */
    color?: string;

    /** Remove handler */
    onRemove?: () => void;
}

/**
 * Tag Badge Component
 * 
 * Multi-tag system badge
 * Follows design guidelines:
 * - 11px font-size, 500 weight
 * - 3px vertical padding, 8px horizontal
 * - 4px border-radius
 */
export function TagBadge({ label, color, onRemove }: TagBadgeProps) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700 rounded mr-1"
            style={color ? { backgroundColor: color } : undefined}
        >
            {label}
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="ml-1 hover:text-gray-900"
                >
                    ×
                </button>
            )}
        </span>
    );
}

interface MetadataItemProps {
    /** Icon */
    icon?: ReactNode;

    /** Label/text */
    label: string;

    /** Color variant */
    variant?: 'default' | 'muted' | 'primary' | 'danger';
}

/**
 * Metadata Item Component
 * 
 * Small inline metadata display (dates, icons, etc.)
 * Follows design guidelines:
 * - 12px font-size
 * - Icon: 16px
 * - Gray-500 color
 */
export function MetadataItem({ icon, label, variant = 'default' }: MetadataItemProps) {
    const variantClasses = {
        default: 'text-gray-900',
        muted: 'text-gray-500',
        primary: 'text-primary',
        danger: 'text-red-600',
    }[variant];

    return (
        <div className={`inline-flex items-center gap-1 text-xs ${variantClasses}`}>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{label}</span>
        </div>
    );
}
