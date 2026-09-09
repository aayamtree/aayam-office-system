// The five doors share one head and one set of parts, so that moving between
// Money In and Money Out feels like moving through one building rather than
// between five screens that grew separately. That was the whole complaint.

import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';

/**
 * Every door names the question it answers and where its figures come from.
 * The source line is not decoration: the old section mixed Zoho figures and
 * dead-ledger figures on one screen with nothing to tell them apart.
 */
export function DoorHeader({
    title, question, source, children,
}: {
    title: string;
    question: string;
    source: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div className="min-w-0">
                <Link
                    href="/admin/finance"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5"
                >
                    <ArrowLeft className="w-3 h-3" /> Finance
                </Link>
                <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{question}</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">{source}</p>
            </div>
            {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>
    );
}

/** A link out of a door to one of the screens that does the actual work. */
export function DoorLink({
    href, label, hint, count,
}: {
    href: string;
    label: string;
    hint: string;
    count?: number | null;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-3 hover:border-primary/50 hover:bg-accent/40 transition-colors"
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{label}</span>
                    {typeof count === 'number' && count > 0 && (
                        <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 tabular-nums">
                            {count}
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
        </Link>
    );
}

/**
 * The same doors as the card row, as one slim strip that sits directly under
 * the header. The team's complaint was simple: the links lived at the foot of
 * a long statement, so on a busy page nobody knew they were there. A row you
 * can see the moment the page opens is worth more than a prettier row you
 * have to scroll to find.
 */
export function DoorNav({
    links,
}: {
    links: { href: string; label: string; count?: number | null }[];
}) {
    return (
        <nav className="flex flex-wrap items-center gap-1.5">
            {links.map((l) => (
                <Link
                    key={l.href + l.label}
                    href={l.href}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:bg-accent/40 transition-colors"
                >
                    <span>{l.label}</span>
                    {typeof l.count === 'number' && l.count > 0 && (
                        <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.5 tabular-nums">
                            {l.count}
                        </span>
                    )}
                    <ArrowUpRight className="w-3 h-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
            ))}
        </nav>
    );
}

/**
 * One headline figure. `tone` is semantic, not decorative: red means money at
 * risk or a problem, never just "important".
 */
export function Figure({
    label, value, note, tone = 'plain',
}: {
    label: string;
    value: string;
    note?: string;
    tone?: 'plain' | 'good' | 'warn' | 'bad';
}) {
    const valueTone =
        tone === 'bad' ? 'text-red-700 dark:text-red-400'
        : tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
        : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-foreground';
    return (
        <div className="rounded-lg border border-border bg-card px-3.5 py-3">
            <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
            <div className={`text-xl font-bold tabular-nums mt-1 ${valueTone}`}>{value}</div>
            {note ? <div className="text-[11px] text-muted-foreground mt-0.5">{note}</div> : null}
        </div>
    );
}

export function DoorSection({
    title, note, children, right,
}: {
    title: string;
    note?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border bg-muted/40">
                <div>
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {note ? <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p> : null}
                </div>
                {right}
            </header>
            {children}
        </section>
    );
}

/**
 * A query that failed must never render as a calm zero. This is the same rule
 * the finance Overview was rewritten around: a confident wrong number reads as
 * reassurance, and reassurance is the most expensive thing this app can give.
 */
export function DoorError({ what, detail }: { what: string; detail?: string | null }) {
    return (
        <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300 flex gap-2.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
            <div>
                <p className="font-semibold mb-0.5">Could not load {what}.</p>
                <p>
                    Nothing is shown below for it — not because there is nothing there, but because the
                    data did not arrive. Try refreshing; if it persists, check the Zoho connection.
                </p>
                {detail ? <p className="mt-1 font-mono text-[10px] opacity-70">{detail}</p> : null}
            </div>
        </div>
    );
}

/** Rupees, no paise. Matches lib/receivables.inr so figures never disagree. */
export const rupees = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

/** Lakhs for headline figures, full rupees everywhere a decision is made. */
export const compact = (n: number) => {
    const v = Math.round(n || 0);
    if (Math.abs(v) >= 10_00_000) return `₹${(v / 10_00_000).toFixed(1)}L`;
    if (Math.abs(v) >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
    return `₹${v}`;
};

/** The one caveat that belongs on every money screen until Vyapar's cash lands. */
export function CashCaveat() {
    return (
        <p className="text-[11px] text-muted-foreground">
            Zoho and the bank only — cash kept in Vyapar is not counted here, so both sides read high.
        </p>
    );
}
