'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'attention';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: React.ReactNode;
    fullWidth?: boolean;
}

/**
 * Button Component - Aayam OMS Design System
 * 
 * Variants:
 * - primary: Blue background, white text (main actions)
 * - secondary: Blue border, blue text (alternative actions)
 * - attention: Orange background, white text (delete/urgent)
 */
export function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    children,
    className,
    ...props
}: ButtonProps) {

    const baseClasses = 'rounded-xl font-medium transition-all duration-150 inline-flex items-center justify-center gap-2';

    const variantClasses = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        attention: 'btn-attention',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-4 py-2 text-base',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className || ''}`}
            {...props}
        >
            {children}
        </button>
    );
}

export default Button;
