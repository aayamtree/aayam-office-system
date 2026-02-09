'use client';

import { MessageCircle } from 'lucide-react';

interface WhatsAppButtonProps {
    phone: string;
    message?: string;
    size?: 'sm' | 'md';
    label?: string;
    className?: string;
}

/**
 * WhatsApp Quick Link Button
 * Opens wa.me with the given phone number (auto-prefixes +91 if needed)
 */
export default function WhatsAppButton({ phone, message, size = 'sm', label, className = '' }: WhatsAppButtonProps) {
    if (!phone) return null;

    // Clean phone number and add country code
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const url = message
        ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/${fullPhone}`;

    const sizeClasses = size === 'sm'
        ? 'p-1.5 rounded-md'
        : 'px-3 py-1.5 rounded-md gap-2';

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors ${sizeClasses} ${className}`}
            title={`WhatsApp ${phone}`}
        >
            <MessageCircle className={size === 'sm' ? 'w-4 h-4' : 'w-4 h-4'} />
            {label && <span className="text-sm font-medium">{label}</span>}
        </a>
    );
}
