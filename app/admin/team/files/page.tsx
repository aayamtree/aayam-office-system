'use client';

import { Share2, Wifi, ExternalLink, Loader2, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePairdropUrl } from '@/lib/hooks/usePairdropUrl';

export default function TeamFilesPage() {
    const { url, loading } = usePairdropUrl();

    return (
        <div className="space-y-4 max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-lg font-semibold tracking-tight">File Transfer</h1>
                <p className="text-sm text-muted-foreground">Share large files instantly across your office — no cloud needed.</p>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
            ) : url ? (
                /* ── Configured: show the launch card ── */
                <div className="bg-white border border-gray-200 rounded-md p-6 space-y-5">
                    {/* Icon + headline */}
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#B8860B]/10 flex items-center justify-center shrink-0">
                            <Share2 className="w-6 h-6 text-[#B8860B]" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-900 text-base">PairDrop — Local Network File Transfer</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Send large files instantly to anyone on the same Wi-Fi. Works like AirDrop —
                                no cloud upload, no size limit, no account required.
                            </p>
                        </div>
                    </div>

                    {/* Wi-Fi reminder */}
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                        <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800 font-medium">
                            Make sure you are connected to the office Wi-Fi before opening.
                        </p>
                    </div>

                    {/* Launch button */}
                    <button
                        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#B8860B] text-white rounded-md font-semibold hover:opacity-90 active:scale-[0.98] transition-all text-sm"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Open File Transfer
                    </button>

                    <p className="text-xs text-gray-400">
                        Opens PairDrop in a new tab. Each device that opens this link will appear as a node — just drag and drop files to share.
                    </p>
                </div>
            ) : (
                /* ── Not configured: setup prompt ── */
                <div className="bg-white border border-dashed border-gray-300 rounded-md p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
                        <Share2 className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">File Transfer Not Configured</p>
                        <p className="text-sm text-gray-500 mt-1">
                            An admin needs to set up PairDrop on an office machine and enter the URL in Settings.
                        </p>
                    </div>
                    <Link
                        href="/admin/settings"
                        className="inline-flex items-center gap-1.5 text-sm text-[#B8860B] font-medium hover:underline"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Go to Settings → File Transfer
                    </Link>
                </div>
            )}

            {/* How it works */}
            <div className="bg-gray-50 border border-gray-100 rounded-md p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">How it works</p>
                <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                    <li>Both devices must be on the same office Wi-Fi</li>
                    <li>Open this page on both devices — you&apos;ll see each other as named nodes</li>
                    <li>Drag a file onto the other device&apos;s icon, or click to pick a file</li>
                    <li>The recipient accepts — file transfers directly, no cloud involved</li>
                </ol>
            </div>
        </div>
    );
}
