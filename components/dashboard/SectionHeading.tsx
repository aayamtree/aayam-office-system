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
    /** The 2026-09-14 restyle: a 5px dot carries the zone instead of an icon
        chip. Same information, a quarter of the ink — the heading is a
        signpost and must never compete with the figures under it. */
    dot: string;
}

/**
 * Complete class strings, never assembled at runtime — Tailwind scans source
 * text, so an interpolated class is simply never generated.
 */
export const ZONES: Record<ZoneKey, Zone> = {
    records: { icon: 'text-zone-records', chip: 'bg-zone-records/10', rule: 'bg-zone-records/35', dot: 'bg-zone-records' },
    today: { icon: 'text-zone-today', chip: 'bg-zone-today/10', rule: 'bg-zone-today/35', dot: 'bg-zone-today' },
    production: { icon: 'text-zone-production', chip: 'bg-zone-production/10', rule: 'bg-zone-production/35', dot: 'bg-zone-production' },
    retail: { icon: 'text-zone-retail', chip: 'bg-zone-retail/10', rule: 'bg-zone-retail/35', dot: 'bg-zone-retail' },
    team: { icon: 'text-zone-team', chip: 'bg-zone-team/10', rule: 'bg-zone-team/35', dot: 'bg-zone-team' },
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
    title,
    note,
    show = true,
}: {
    zone: ZoneKey;
    /** Still accepted by every call site; no longer drawn since 2026-09-14. */
    icon?: LucideIcon;
    title: string;
    /** Optional right-hand line: a count or a date. Never a warning. */
    note?: string;
    /** False when every block this heading names is hidden. */
    show?: boolean;
}) {
    if (!show) return null;
    const z = ZONES[zone];
    // The 2026-09-14 layout rebuild: headings are now a rule with a label on
    // it, not a bar with a boxed icon. Satish's reference dashboards all do
    // this — the section names itself and then gets out of the way. `icon` is
    // still accepted (and still typed) so every existing call site keeps
    // working; it is simply no longer drawn.
    return (
        <div className="flex items-center gap-2.5 pt-5">
            <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${z.dot}`} aria-hidden="true" />
            <h3 className="min-w-0 shrink-0 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {title}
            </h3>
            <span className="h-px min-w-[1.5rem] flex-1 bg-border" aria-hidden="true" />
            {note && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{note}</span>
            )}
        </div>
    );
}
