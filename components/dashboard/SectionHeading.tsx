// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ZONES — colour as a label, never as decoration
// ═══════════════════════════════════════════════════════════════════════════
//
// Satish, 2026-09-12: make it a little colourful in our own colour scheme, so
// the blocks are isolated and easy to identify.
//
// THE RULE THAT KEEPS THIS FROM BECOMING A RAINBOW
//
// Colour on this page carries two meanings, and they never share a role:
//
//   ZONE  — which part of the business a block belongs to. Appears ONLY on a
//           section heading: the icon chip and the rule under it.
//   STATE — good / warning / critical. Appears ONLY on figures, badges and
//           severity marks inside a card.
//
// The first draft of this file claimed that was enough on its own. It was not.
// The audit caught the Today zone in oms-orange (#E89D01, hue 40°) sitting
// directly above the Needs Attention card, which is a whole amber-filled panel
// (amber-600, hue 32°) — eight degrees apart, two small icons forty pixels
// apart. The rule held on paper and failed in the eye. So the zone palette now
// also AVOIDS red, amber and green outright: a coloured marker on this page is
// either unmistakably a zone hue or unmistakably a state hue.
//
// The five hues live in app/globals.css as --zone-* (light and dark), because
// the five chart tokens could not supply five zone colours that were both
// distinguishable and legible — chart-2 is the destructive coral and chart-3
// is amber, both already spoken for by state, and chart-5 measured 2.4:1 on
// the page, too faint to read as a colour at all. Every zone hue here clears
// 4.5:1 against the page background at 14px.
//
// To add a zone: add the token to globals.css in BOTH blocks first, then here.
// Never hand-write a hex in this file.
// ═══════════════════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react';

export type ZoneKey = 'records' | 'today' | 'production' | 'retail' | 'team';

interface Zone {
    icon: string;
    chip: string;
    rule: string;
}

/**
 * Complete class strings, never assembled at runtime — Tailwind scans source
 * text, so an interpolated class is simply never generated.
 */
export const ZONES: Record<ZoneKey, Zone> = {
    records: { icon: 'text-zone-records', chip: 'bg-zone-records/10', rule: 'bg-zone-records/35' },
    today: { icon: 'text-zone-today', chip: 'bg-zone-today/10', rule: 'bg-zone-today/35' },
    production: { icon: 'text-zone-production', chip: 'bg-zone-production/10', rule: 'bg-zone-production/35' },
    retail: { icon: 'text-zone-retail', chip: 'bg-zone-retail/10', rule: 'bg-zone-retail/35' },
    team: { icon: 'text-zone-team', chip: 'bg-zone-team/10', rule: 'bg-zone-team/35' },
};

/**
 * The heading that opens a zone.
 *
 * Sits ABOVE the cards rather than around them, so no existing widget had to
 * be rewritten to gain an identity, and the cards keep the single white
 * surface the design system asks for.
 *
 * `show` exists because every block on this dashboard can be switched off in
 * the Widgets menu. Without it, hiding the last widget in a zone left its
 * heading behind — a labelled, ruled bar with nothing under it. A heading is
 * only ever as visible as the thing it names.
 */
export default function SectionHeading({
    zone,
    icon: Icon,
    title,
    note,
    show = true,
}: {
    zone: ZoneKey;
    icon: LucideIcon;
    title: string;
    /** Optional right-hand line: a count or a date. Never a warning. */
    note?: string;
    /** False when every block this heading names is hidden. */
    show?: boolean;
}) {
    if (!show) return null;
    const z = ZONES[zone];
    return (
        <div className="flex items-center gap-2.5 pt-1">
            <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${z.chip}`}
                aria-hidden="true"
            >
                <Icon className={`h-3.5 w-3.5 ${z.icon}`} strokeWidth={2} />
            </span>
            <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-foreground/80">
                {title}
            </h3>
            <span className={`h-px min-w-[1.5rem] flex-1 rounded-full ${z.rule}`} aria-hidden="true" />
            {note && (
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {note}
                </span>
            )}
        </div>
    );
}
