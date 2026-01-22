/**
 * Role-Based Access Control Utilities
 */

import { supabase } from './supabase';

export type UserRole = 'admin' | 'finance' | 'designer' | 'marketing' | 'dispatch' | 'cmyk';

export interface UserProfile {
    id: string;
    name: string;
    username: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    last_login_at: string | null;
    force_password_change: boolean;
}

/**
 * Get current user's profile with role
 */
export async function getUserProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return profile;
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
    const profile = await getUserProfile();
    return profile?.role === role && profile?.is_active === true;
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
    const profile = await getUserProfile();
    return profile ? roles.includes(profile.role) && profile.is_active : false;
}

/**
 * Check if user is admin or account (full access)
 */
export async function isAdminOrAccount(): Promise<boolean> {
    return await hasAnyRole(['admin', 'finance']);
}

/**
 * Role-based permissions
 */
export const rolePermissions = {
    admin: {
        canAccessDesignStudio: true,
        canAccessCRM: true,
        canAccessSales: true,
        canAccessFinance: true,
        canAccessDispatch: true,
        canAccessCMYK: true,
        canAccessReports: true,
        canAccessSettings: true,
        canManageUsers: true,
    },
    account: {
        canAccessDesignStudio: true,
        canAccessCRM: true,
        canAccessSales: true,
        canAccessFinance: true,
        canAccessDispatch: true,
        canAccessCMYK: true,
        canAccessReports: true,
        canAccessSettings: true,
        canManageUsers: false,
    },
    designer: {
        canAccessDesignStudio: true,
        canAccessCRM: false,
        canAccessSales: false,
        canAccessFinance: false,
        canAccessDispatch: false,
        canAccessCMYK: false,
        canAccessReports: true, // Own reports only
        canAccessSettings: false,
        canManageUsers: false,
    },
    marketing: {
        canAccessDesignStudio: false,
        canAccessCRM: true,
        canAccessSales: true,
        canAccessFinance: false,
        canAccessDispatch: false,
        canAccessCMYK: false,
        canAccessReports: true, // Own reports only
        canAccessSettings: false,
        canManageUsers: false,
    },
    dispatch: {
        canAccessDesignStudio: false,
        canAccessCRM: false,
        canAccessSales: false,
        canAccessFinance: false,
        canAccessDispatch: true,
        canAccessCMYK: false,
        canAccessReports: true, // Own reports only
        canAccessSettings: false,
        canManageUsers: false,
    },
    cmyk: {
        canAccessDesignStudio: false,
        canAccessCRM: false,
        canAccessSales: false,
        canAccessFinance: false,
        canAccessDispatch: false,
        canAccessCMYK: true,
        canAccessReports: true, // Own reports only
        canAccessSettings: false,
        canManageUsers: false,
    },
};

/**
 * Get user's permissions
 */
export async function getUserPermissions() {
    const profile = await getUserProfile();
    if (!profile || !profile.is_active) return null;

    return rolePermissions[profile.role];
}

/**
 * Check if user can access a specific module
 */
export async function canAccessModule(module: keyof typeof rolePermissions.admin): Promise<boolean> {
    const permissions = await getUserPermissions();
    return permissions ? permissions[module] : false;
}

/**
 * Get username from email (for login conversion)
 */
export function getUsernameFromEmail(email: string): string {
    return email.split('@')[0];
}

/**
 * Convert username to internal email format
 */
export function usernameToEmail(username: string): string {
    return `${username.toLowerCase()}@aayam.internal`;
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
    // Username must be 3-20 characters, alphanumeric only
    const usernameRegex = /^[a-z0-9]{3,20}$/;
    return usernameRegex.test(username.toLowerCase());
}
