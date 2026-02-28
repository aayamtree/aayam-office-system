/**
 * Offline-First Note Queue
 * ─────────────────────────
 * Notes are saved to localStorage immediately and synced to
 * Supabase in the background every SYNC_INTERVAL_MS milliseconds.
 * Users never see blocking errors — failed syncs retry silently.
 */

export const SYNC_INTERVAL_MS = 30_000; // 30 seconds

export type QueuedNoteStatus = 'pending' | 'syncing' | 'failed';

export interface QueuedNote {
    localId: string;       // Temporary local ID (uuid-like)
    jobId: string;
    userId: string;
    content: string;
    tag: string;
    source: string;
    createdAt: string;     // ISO timestamp
    status: QueuedNoteStatus;
    retries: number;
    lastError?: string;
}

const QUEUE_KEY = 'aayam_note_queue';

// ─── Read / Write localStorage ───────────────────────────────────────────────

export function readQueue(): QueuedNote[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeQueue(queue: QueuedNote[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
        // localStorage might be full — best effort
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Add a note to the local queue. Returns the queued note with localId. */
export function enqueueNote(
    note: Omit<QueuedNote, 'localId' | 'status' | 'retries' | 'createdAt'>
): QueuedNote {
    const queued: QueuedNote = {
        ...note,
        localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        status: 'pending',
        retries: 0,
    };
    const queue = readQueue();
    writeQueue([...queue, queued]);
    return queued;
}

/** Remove a note from the queue (after successful sync). */
export function dequeueNote(localId: string) {
    const queue = readQueue().filter(n => n.localId !== localId);
    writeQueue(queue);
}

/** Mark a note as failed with an error message. */
export function markFailed(localId: string, error: string) {
    const queue = readQueue().map(n =>
        n.localId === localId
            ? { ...n, status: 'failed' as QueuedNoteStatus, retries: n.retries + 1, lastError: error }
            : n
    );
    writeQueue(queue);
}

/** Get all notes pending sync (pending or failed with <5 retries). */
export function getPendingNotes(): QueuedNote[] {
    return readQueue().filter(n => n.status === 'pending' || (n.status === 'failed' && n.retries < 5));
}

/** Check if a note with the given localId is still in the queue. */
export function isNoteQueued(localId: string): boolean {
    return readQueue().some(n => n.localId === localId);
}
