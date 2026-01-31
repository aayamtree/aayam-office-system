'use client';

import React from 'react';

type BadgeVariant = 'approved' | 'action' | 'draft';

interface BadgeProps {
    variant: BadgeVariant;
    children: React.ReactNode;
    className?: string;
}

/**
 * Badge Component - Aayam OMS Design System
 * 
 * Variants:
 * - approved: Blue background (Completed, Approved status)
 * - action: Orange background (Action Needed, On Hold, Urgent)
 * - draft: Light grey background (Draft, Neutral, Pending)
 */
export function Badge({ variant, children, className }: BadgeProps) {
    const variantClasses = {
        approved: 'badge-approved',
        action: 'badge-action',
        draft: 'badge-draft',
    };

    return (
        <span className={`${variantClasses[variant]} ${className || ''}`}>
            {children}
        </span>
    );
}

export default Badge;
