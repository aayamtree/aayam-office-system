import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton preset for a job card (mobile list view)
 */
export function JobCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="h-8 bg-gray-700 px-3 py-2" />
            <div className="px-3 py-2.5 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-gray-100">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-7 w-7 rounded-md" />)}
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton preset for the Kanban desktop table row
 */
export function JobTableRowSkeleton() {
    return (
        <tr>
            <td className="px-4 py-3"><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-48" /></td>
            <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
            <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-md" /></td>
            <td className="px-4 py-3"><Skeleton className="h-5 w-28 rounded-md" /></td>
            <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-8 rounded-md" />)}</div></td>
        </tr>
    );
}

/**
 * Skeleton preset for a vendor card (mobile)
 */
export function VendorCardSkeleton() {
    return (
        <div className="bg-white rounded-md overflow-hidden border border-gray-100">
            <div className="h-14 bg-gray-200" />
            <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex justify-between pt-3 border-t border-gray-100">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <div className="flex gap-1">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-8 rounded-md" />)}</div>
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton preset for a client card row (mobile)
 */
export function ClientCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="flex gap-1">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-8 rounded-md" />)}</div>
        </div>
    );
}

/**
 * Skeleton for finance table rows (desktop)
 */
export function FinanceTableRowSkeleton({ cols = 5 }: { cols?: number }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-6 py-4">
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                </td>
            ))}
        </tr>
    );
}

/**
 * Stats card skeleton (dashboard / jobs header)
 */
export function StatCardSkeleton() {
    return (
        <div className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-7 w-20" />
        </div>
    );
}

/**
 * Calendar cell skeleton row
 */
export function CalendarGridSkeleton() {
    return (
        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border border-border">
            {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[44px] bg-background p-1">
                    <Skeleton className="h-4 w-4 rounded-full mb-1" />
                    <Skeleton className="h-2 w-3/4" />
                </div>
            ))}
        </div>
    );
}
