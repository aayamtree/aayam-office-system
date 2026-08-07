// ─────────────────────────────────────────────────────────────────────────────
// Per-user capability flags
//
// Roles are single-valued (profiles.role holds ONE string). When one specific
// person needs one extra area without giving up their existing role, we add a
// boolean flag on profiles rather than inventing a new role — the same pattern
// as profiles.can_design.
//
// Keep this file as the ONLY place that decides what a flag unlocks, so the
// sidebar, the mobile nav and the route guard can never drift apart.
// ─────────────────────────────────────────────────────────────────────────────

/** Route prefixes unlocked by profiles.can_plan_prints. */
export const PRINT_PLANNER_PREFIXES = ['/admin/print-planner', '/admin/print-runs'];

/** Sidebar/nav hrefs unlocked by profiles.can_plan_prints. */
export const PRINT_PLANNER_HREFS = ['/admin/print-planner', '/admin/print-runs'];

/** Minimal shape we need — avoids importing the full profile type everywhere. */
export interface CapabilityProfile {
    role?: string | null;
    can_plan_prints?: boolean | null;
}

/**
 * Does this profile hold the print-setup capability?
 * Admins always do; everyone else needs the explicit flag.
 */
export function canPlanPrints(profile?: CapabilityProfile | null): boolean {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return profile.can_plan_prints === true;
}

/**
 * Should this profile be allowed on `pathname`, given the role list already
 * configured for it? Returns true only when a capability flag grants access
 * that the role alone would not.
 */
export function hasCapabilityFor(pathname: string, profile?: CapabilityProfile | null): boolean {
    if (!profile) return false;
    if (PRINT_PLANNER_PREFIXES.some(p => pathname.startsWith(p))) {
        return canPlanPrints(profile);
    }
    return false;
}

/**
 * Should this nav item be visible, given the role list already configured for
 * it? Same idea as hasCapabilityFor, but keyed on the menu href.
 */
export function hasCapabilityForHref(href: string, profile?: CapabilityProfile | null): boolean {
    if (!profile) return false;
    if (PRINT_PLANNER_HREFS.includes(href)) {
        return canPlanPrints(profile);
    }
    return false;
}
