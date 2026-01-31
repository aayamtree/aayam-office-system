'use client';

import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Card Component - Aayam OMS Design System
 * Container for content sections
 */
export function Card({ children, className }: CardProps) {
    return (
        <div className={`card-primary ${className || ''}`}>
            {children}
        </div>
    );
}

/**
 * CardHeader - Styled header for cards
 * Uses design system typography (20px, semibold)
 */
export function CardHeader({ children, className }: CardProps) {
    return (
        <h2 className={`card-header ${className || ''}`}>
            {children}
        </h2>
    );
}

/**
 * CardContent - Styled content area
 * Uses design system body text
 */
export function CardContent({ children, className }: CardProps) {
    return (
        <div className={`card-content ${className || ''}`}>
            {children}
        </div>
    );
}

export default Card;
