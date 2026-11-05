import { createBrowserClient } from '@supabase/ssr';
import { auditedFetch } from '@/lib/query-failure';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
}

/**
 * Build a browser client whose failed queries are never silent.
 *
 * `auditedFetch` is the whole point. Most call sites in this app do
 * `const { data } = await supabase.from(...)` and then render `data || []`, so a
 * failed query becomes an empty screen with nothing said to anyone — which is
 * how both the 2026-07-06 phantom-column bug and the 2026-08-01 emptied-table
 * fault survived for days. Catching it at the transport layer covers every call
 * site at once, including the ones that never destructure `error`.
 *
 * ALWAYS use this rather than calling createBrowserClient directly. A client
 * built by hand skips the net, and the page it powers goes back to failing
 * quietly. scripts/audit-error-handling.js fails the build on direct use.
 */
/**
 * Trial screens work on a TEST COPY of the live data (schema "trial", same project).
 * PostgREST picks the schema from these two headers, so ONE client serves both: on the Trial
 * routes below every database call goes to the copy, everywhere else it goes to the live tables.
 */
const TRIAL_ROUTES = /^\/admin\/finance\/(receive-money|invoices-new|sales-new|purchases-new|banking-new|accounts-new|reports-new)(\/|$)/;
export const isTrialRoute = (path: string) => TRIAL_ROUTES.test(path);

const trialAwareFetch: typeof fetch = (input, init) => {
  if (typeof window !== 'undefined' && isTrialRoute(window.location.pathname)) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : '';
    if (url.includes('/rest/v1/')) {
      const headers = new Headers(init?.headers);
      headers.set('Accept-Profile', 'trial');
      headers.set('Content-Profile', 'trial');
      return auditedFetch(input, { ...init, headers });
    }
  }
  return auditedFetch(input, init);
};

function buildClient() {
  return createBrowserClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    { global: { fetch: trialAwareFetch } },
  );
}

// Typed from buildClient, NOT from `typeof createBrowserClient`.
//
// createBrowserClient is generic over the database type, so ReturnType of the
// generic function resolves its parameters to their defaults and hands back a
// loosely-typed client. That quietly turned every `.select()` callback parameter
// into an implicit `any` and produced 20 TS7006/TS7031 errors across the app.
// buildClient is concrete, so ReturnType gives back exactly what the call site
// used to infer.
let browserClient: ReturnType<typeof buildClient> | null = null;

export function createAuditedBrowserClient() {
  // Memoised deliberately, and not just to save an allocation.
  //
  // Several pages call this in the component body and then list the client in a
  // useCallback dependency array (`[activeCategory, supabase]`). If a fresh
  // object came back on every render, that dependency would change every render,
  // the callback would be rebuilt, and the useEffect that depends on it would
  // refetch forever. @supabase/ssr happens to memoise internally, so the old
  // code survived on that — but relying on a library's caching for a render-loop
  // guarantee is not something to leave implicit. One client, one identity.
  if (!browserClient) browserClient = buildClient();
  return browserClient;
}

// The shared singleton. Components that already import this get the net for free.
export const supabase = createAuditedBrowserClient();

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-key');
};
