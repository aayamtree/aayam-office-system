/**
 * Server-side auth guards for API routes.
 *
 * Any route that uses the service-role key bypasses RLS entirely, so it MUST
 * establish who the caller is before doing anything. These helpers read the
 * Supabase SSR cookie session and verify the JWT against the auth server
 * (getUser(), not getSession() — the latter trusts the cookie blindly).
 *
 * Usage:
 *
 *   const gate = await requireUser();
 *   if (!gate.ok) return gate.response;
 *   // gate.user is a verified, logged-in staff member
 *
 *   const gate = await requireAdmin();
 *   if (!gate.ok) return gate.response;
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type Denied = { ok: false; response: NextResponse };
type AllowedUser = { ok: true; user: User; client: SupabaseClient };
type AllowedAdmin = AllowedUser & { role: string };

/** Supabase client bound to the caller's cookie session (anon key, RLS applies). */
export async function getSessionClient(): Promise<SupabaseClient> {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (list) =>
                    list.forEach(({ name, value, options }) => {
                        try {
                            cookieStore.set(name, value, options);
                        } catch {
                            // Route handlers can't always set cookies — safe to ignore.
                        }
                    }),
            },
        }
    );
}

/** Require any authenticated staff member. */
export async function requireUser(): Promise<AllowedUser | Denied> {
    const client = await getSessionClient();
    const {
        data: { user },
    } = await client.auth.getUser();

    if (!user) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Your session has expired. Please sign in again.' },
                { status: 401 }
            ),
        };
    }

    return { ok: true, user, client };
}

/** Require an authenticated user whose profile role is admin. */
export async function requireAdmin(): Promise<AllowedAdmin | Denied> {
    const gate = await requireUser();
    if (!gate.ok) return gate;

    const { data: profile } = await gate.client
        .from('profiles')
        .select('role')
        .eq('id', gate.user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 }),
        };
    }

    return { ...gate, role: profile.role };
}

/**
 * Authorize a cron endpoint.
 *
 * Accepts either the Vercel cron `Authorization: Bearer $CRON_SECRET` header,
 * or — for `?debug=1` previews — a logged-in admin session. Fails CLOSED if
 * CRON_SECRET is not configured, so a missing env var can never leave a
 * service-role endpoint open to the internet.
 */
export async function authorizeCron(request: {
    url: string;
    headers: Headers;
    nextUrl?: { searchParams: URLSearchParams };
}): Promise<{ ok: true; isDebug: boolean } | Denied> {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (secret && authHeader === `Bearer ${secret}`) {
        return { ok: true, isDebug: false };
    }

    const params = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    if (params.get('debug') === '1') {
        const gate = await requireAdmin();
        if (!gate.ok) return gate;
        return { ok: true, isDebug: true };
    }

    return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
}

/** Require one of the given profile roles (admin always passes). */
export async function requireRole(roles: string[]): Promise<AllowedAdmin | Denied> {
    const gate = await requireUser();
    if (!gate.ok) return gate;

    const { data: profile } = await gate.client
        .from('profiles')
        .select('role')
        .eq('id', gate.user.id)
        .single();

    const role = profile?.role;
    if (!role || (role !== 'admin' && !roles.includes(role))) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    return { ...gate, role };
}
