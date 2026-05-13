'use client';

import { Share2, ExternalLink } from 'lucide-react';
import { usePairdropUrl } from '@/lib/hooks/usePairdropUrl';

/**
 * Compact PairDrop quick-link banner.
 * Shows only when a URL is configured — renders nothing otherwise.
 */
export default function PairDropBanner() {
    const { url, loading } = usePairdropUrl();

    if (loading || !url) return null;

    return (
        <button
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-between gap-2 bg-[#B8860B]/10 border border-[#B8860B]/30 rounded-md px-3 py-2 hover:bg-[#B8860B]/15 transition-colors group"
        >
            <div className="flex items-center gap-2 min-w-0">
                <Share2 className="w-3.5 h-3.5 text-[#B8860B] shrink-0" />
                <span className="text-xs font-semibold text-[#B8860B] truncate">File Transfer</span>
                <span className="text-xs text-[#B8860B]/60 hidden sm:inline truncate">· Send files on office Wi-Fi</span>
            </div>
            <ExternalLink className="w-3 h-3 text-[#B8860B]/60 group-hover:text-[#B8860B] shrink-0 transition-colors" />
        </button>
    );
}
