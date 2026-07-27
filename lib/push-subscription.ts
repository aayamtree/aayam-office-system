/**
 * Shared push-subscription helper.
 *
 * THE BUG THIS FIXES (found 2026-07-27)
 * -------------------------------------
 * Both push components used to do this:
 *
 *     const existing = await reg.pushManager.getSubscription();
 *     const sub = existing || (await reg.pushManager.subscribe({ ... }));
 *
 * A browser's push subscription is permanently bound to the VAPID public key it
 * was created with. When the VAPID keys were rotated on 26 July, every staff
 * browser kept its OLD subscription object — so `existing` was truthy, the code
 * short-circuited, and it re-saved a subscription signed with a key the server
 * no longer holds. Those subscriptions can never receive a notification, but
 * they look perfectly healthy in the database.
 *
 * Worse, the push service rejects them with 403, and the send route only prunes
 * on 404/410 — so they would have sat there failing silently forever.
 *
 * The fix: compare the key the subscription was actually created with against
 * the key we are using now. If they differ, unsubscribe and make a fresh one.
 *
 * This means the next VAPID rotation self-heals — nobody has to be chased.
 */

/** base64url (VAPID) → Uint8Array, the format pushManager.subscribe() wants. */
export function vapidKeyToBytes(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

/** Remembers which VAPID key we last subscribed with, for browsers that don't
 *  expose `subscription.options` (older Safari / some iOS versions). */
const LAST_KEY_STORAGE = 'aayam_push_vapid_key';

function bytesMatch(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
    if (!a) return false;
    const view = new Uint8Array(a);
    if (view.length !== b.length) return false;
    for (let i = 0; i < b.length; i++) if (view[i] !== b[i]) return false;
    return true;
}

/**
 * Is this existing subscription still valid for the VAPID key we use today?
 *
 * Preferred check is the real key on the subscription. Where the browser doesn't
 * expose it, fall back to what we recorded in localStorage at subscribe time.
 * If we genuinely cannot tell, we assume it is STALE and resubscribe — a
 * needless resubscribe is harmless, a missed one means silent dead notifications.
 */
function subscriptionMatchesCurrentKey(sub: PushSubscription, vapidKey: string): boolean {
    const wanted = vapidKeyToBytes(vapidKey);
    const actual = sub.options?.applicationServerKey as ArrayBuffer | null | undefined;

    if (actual) return bytesMatch(actual, wanted);

    try {
        return localStorage.getItem(LAST_KEY_STORAGE) === vapidKey;
    } catch {
        return false;
    }
}

/**
 * Return a push subscription that is guaranteed to be bound to the CURRENT
 * VAPID key, replacing a stale one if necessary. Returns null if push isn't
 * available or permission isn't granted.
 */
export async function getFreshPushSubscription(
    registration: ServiceWorkerRegistration,
    vapidKey: string
): Promise<PushSubscription | null> {
    if (!('PushManager' in window) || !vapidKey) return null;

    const existing = await registration.pushManager.getSubscription();

    if (existing) {
        if (subscriptionMatchesCurrentKey(existing, vapidKey)) return existing;

        // Bound to a retired key — drop it so a new one can be created.
        console.info('[push] Subscription was made with an old VAPID key — resubscribing.');
        try {
            await existing.unsubscribe();
        } catch {
            // Even if unsubscribe fails, subscribe() below usually supersedes it.
        }
    }

    const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToBytes(vapidKey) as BufferSource,
    });

    try {
        localStorage.setItem(LAST_KEY_STORAGE, vapidKey);
    } catch {
        // Private mode — the options check above still covers us.
    }

    return sub;
}
