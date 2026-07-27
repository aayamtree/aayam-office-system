// System Health — data-integrity checks. Always live (no cache) so it reflects
// the current state of the database every time it's opened.
import { createServerSupabase } from '@/lib/supabase-server';

export const revalidate = 0;

type Check = { category: string; check: string; status: 'ok' | 'warn' | 'fail' | 'info'; detail: string };

const STYLES: Record<Check['status'], { dot: string; badge: string; label: string }> = {
    ok:   { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'OK' },
    warn: { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'WARN' },
    fail: { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200',             label: 'FAIL' },
    info: { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200',       label: 'INFO' },
};

export default async function HealthPage() {
    const db = createServerSupabase();
    const { data, error } = await db.rpc('fn_system_health_check');
    const checks: Check[] = Array.isArray(data) ? data : [];

    const fails = checks.filter(c => c.status === 'fail').length;
    const warns = checks.filter(c => c.status === 'warn').length;
    const overall = fails > 0 ? 'fail' : warns > 0 ? 'warn' : 'ok';
    const banner = {
        ok:   { cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', msg: 'All systems wired correctly — data is flowing where it should.' },
        warn: { cls: 'bg-amber-50 border-amber-200 text-amber-800',       msg: `${warns} thing(s) need attention (no breakage).` },
        fail: { cls: 'bg-red-50 border-red-200 text-red-800',             msg: `${fails} issue(s) found where data isn't matching — review below.` },
    }[overall];

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">System Health</h1>
                <p className="text-sm text-gray-500">
                    Checks that every part of the app is wired correctly and data lands where it should.
                    Reload this page anytime — it always reads the live database.
                </p>
            </div>

            {error && (
                <div className="p-4 rounded-lg border bg-red-50 border-red-200 text-red-800 text-sm">
                    Couldn’t run the health check: {error.message}
                </div>
            )}

            {!error && (
                <div className={`p-4 rounded-lg border text-sm font-medium ${banner.cls}`}>{banner.msg}</div>
            )}

            <div className="space-y-3">
                {checks.map((c, i) => {
                    const s = STYLES[c.status];
                    return (
                        <div key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-white">
                            <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm">{c.check}</span>
                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${s.badge}`}>{s.label}</span>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">{c.category}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-0.5 break-words">{c.detail}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-xs text-gray-400">
                Generated {new Date().toLocaleString('en-IN')} · powered by <code>fn_system_health_check()</code>
            </p>
        </div>
    );
}
