'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { Profile, UserRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isDesigner: boolean;
  isFinance: boolean;
  bypassLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo user for when Supabase is not configured
const DEMO_USER: Profile = {
  id: 'demo-user-id',
  email: 'admin@aayam.com',
  full_name: 'SATISH',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    // Try to load from local storage immediately to prevent flicker
    if (typeof window !== 'undefined') {
      // Don't restore cached profile if user just signed out
      if (sessionStorage.getItem('aayam_signing_out') === 'true') return null;
      const cached = localStorage.getItem('aayam_fallback_profile');
      if (cached) {
        try { return JSON.parse(cached); } catch { }
      }
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured] = useState<boolean>(isSupabaseConfigured());

  // Fetch user profile (optimized with better caching)
  const fetchProfile = async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching profile, attempting to create default:', error);

        if (userEmail) {
          // Check if we have a cached fallback in local storage
          const cached = localStorage.getItem('aayam_fallback_profile');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed.id === userId) {
                setProfile(parsed);
                setLoading(false);
                return;
              }
            } catch (e) { }
          }

          // CRITICAL FIX: Do NOT default to 'admin' - this is a security risk!
          // If a user's profile is missing from DB, we should NOT grant admin access
          // Instead, log an error and handle gracefully
          console.error('🚨 CRITICAL: User profile missing from database!', {
            userId,
            email: userEmail
          });

          // Create a minimal profile WITHOUT a role - this will prevent any menu items from showing
          // Admin must manually assign the correct role via Supabase dashboard or settings
          const newProfile: Profile = {
            id: userId,
            email: userEmail,
            full_name: userEmail.split('@')[0].toUpperCase(),
            role: null as any, // EXPLICIT NULL - forces manual role assignment
            is_active: false, // Mark as inactive until properly configured
            created_at: new Date().toISOString(),
          };

          // Save for resilience
          localStorage.setItem('aayam_fallback_profile', JSON.stringify(newProfile));

          // Attempt to fix DB
          const { error: insertError } = await supabase
            .from('profiles')
            .upsert([newProfile]) // Upsert is safer
            .select()
            .single();

          if (insertError) {
            console.error('Failed to auto-create profile:', insertError);
            // Fallback to local state ONLY if DB fails, so user can at least work
            setProfile(newProfile);
          } else {
            // If insert worked, we are good.
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } else {
        setProfile(data);
        // Cache for faster subsequent loads
        localStorage.setItem('aayam_fallback_profile', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If Supabase is not configured, use demo mode
    if (!isConfigured) {
      setProfile(DEMO_USER);
      setLoading(false);
      return;
    }

    // SPEED MODE: DYNAMIC ROLE
    const savedSpeedRole = typeof window !== 'undefined' ? localStorage.getItem('aayam_speed_role') : null;

    if (savedSpeedRole) {
      const roleKey = savedSpeedRole as UserRole;
      // Mock Profiles for Speed Login
      const mockId = `speed-${roleKey}-${Math.random().toString(36).substr(2, 5)}`;

      const speedProfile: Profile = {


        id: roleKey === 'admin' ? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' :
          roleKey === 'designer' ? 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22' :
            roleKey === 'marketing' ? '40eebc99-9c0b-4ef8-bb6d-6bb9bd380433' : // Valid UUID (replaced m with 4)
              roleKey === 'dispatch' ? '50eebc99-9c0b-4ef8-bb6d-6bb9bd380544' : // Valid UUID (replaced p with 5)
                roleKey === 'cmyk' ? 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c55' :
                  roleKey === 'finance' ? 'acebc99-9c0b-4ef8-bb6d-6bb9bd380a55' :
                    '60eebc99-9c0b-4ef8-bb6d-6bb9bd380666', // fallback (replaced u with 6)

        email: `${roleKey}@aayam.com`,
        full_name: `Speed ${roleKey.charAt(0).toUpperCase() + roleKey.slice(1)}`,
        role: roleKey,
        is_active: true,
        created_at: new Date().toISOString()
      };

      setProfile(speedProfile);
      setUser({ id: speedProfile.id, email: speedProfile.email, role: 'authenticated' } as User);
      setLoading(false);
      return;
    }

    // Check for Bypass Mode (Legacy)
    if (localStorage.getItem('aayam_bypass_mode') === 'true') {
      const cached = localStorage.getItem('aayam_fallback_profile');
      if (cached) {
        try {
          const p = JSON.parse(cached);
          setProfile(p);
          setUser({ id: p.id, email: p.email, role: 'authenticated' } as User);
          setLoading(false);
          return;
        } catch (e) { }
      }
    }

    let mounted = true;
    let stopHeartbeat: (() => void) | null = null;

    // Get initial session — NON-BLOCKING (middleware handles route protection)
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id, session.user.email);
          // Start heartbeat for existing session (page reload, tab reopen)
          if (!stopHeartbeat) stopHeartbeat = startHeartbeat();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('Session init (non-blocking):', err);
        if (!mounted) return;

        // Use cached profile as fallback
        const cached = localStorage.getItem('aayam_fallback_profile');
        if (cached) {
          try {
            const cachedProfile = JSON.parse(cached);
            setProfile(cachedProfile);
            setUser({ id: cachedProfile.id, email: cachedProfile.email, role: 'authenticated' } as User);
          } catch (e) { }
        }
        setLoading(false);
      }
    };

    initSession();

    // ── DAILY SESSION RESET ──────────────────────────────────────────────────
    // If the stored session date is not today, force sign-out so the designer
    // must log in freshly each morning (office hours 9 AM – 7:30 PM).
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('aayam_session_date');
      const today = new Date().toISOString().split('T')[0];
      // Only applies to real Supabase sessions (not speed/bypass mode)
      const isSpeedMode = !!localStorage.getItem('aayam_speed_role');
      const isBypassMode = localStorage.getItem('aayam_bypass_mode') === 'true';
      if (savedDate && savedDate !== today && !isSpeedMode && !isBypassMode) {
        // New day — invalidate the old session and force re-login
        console.info('[Attendance] New day detected — forcing re-login for fresh attendance record.');
        localStorage.removeItem('aayam_session_date');
        // Fire logout to record last_logout_time for previous day
        navigator.sendBeacon('/api/attendance/logout');
        // Clear auth state and redirect
        supabase.auth.signOut({ scope: 'local' }).finally(() => {
          localStorage.removeItem('aayam_fallback_profile');
          window.location.href = '/login?reason=new_day';
        });
        return;
      }
    }

    // ── BEACON LOGOUT on browser/tab close ──────────────────────────────────
    // navigator.sendBeacon is reliable even during page unload (unlike fetch).
    // Fires when: tab closes, browser quits, or PC shuts down via OS kill.
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/attendance/logout');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also fire when the tab is hidden (covers some mobile + rapid close cases)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        navigator.sendBeacon('/api/attendance/logout');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for auth changes - but don't cause flickering
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        // Only update on actual sign in/out events
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            // Don't await this so it doesn't block signInWithPassword from resolving
            fetchProfile(session.user.id, session.user.email);
            // Start heartbeat on fresh sign-in
            if (!stopHeartbeat) stopHeartbeat = startHeartbeat();
          } else {
            // Stop heartbeat on sign-out
            stopHeartbeat?.();
            stopHeartbeat = null;
            setProfile(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      stopHeartbeat?.(); // stop the 5-min interval on unmount
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConfigured]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    // Demo mode login
    if (!isConfigured) {
      if (email === 'admin@aayam.com' && password === 'admin123') {
        setProfile(DEMO_USER);
        return { error: null };
      }
      return { error: 'Invalid credentials. Use admin@aayam.com / admin123' };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error: error.message };

      // Store today's date so we can detect a new day on next load
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('aayam_session_date', new Date().toISOString().split('T')[0]);
        }
      }, 500);

      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    }
  };

  // Sign up new user
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'sales'
  ) => {
    if (!isConfigured) {
      return { error: 'Supabase not configured. Cannot create new users in demo mode.' };
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    }
  };

  // Attendance: fire login API and start heartbeat for designers
  const fireAttendanceLogin = async () => {
    try { await fetch('/api/attendance/login', { method: 'POST' }); } catch (e) { /* non-blocking */ }
  };

  const fireAttendanceLogout = async () => {
    try { await fetch('/api/attendance/logout', { method: 'POST' }); } catch (e) { /* non-blocking */ }
  };

  // Start heartbeat interval — returned cleanup fn stops it
  const startHeartbeat = () => {
    const interval = setInterval(async () => {
      try { await fetch('/api/attendance/heartbeat', { method: 'POST' }); } catch (e) { }
    }, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  };

  // Sign out
  const signOut = async () => {
    // Set a flag FIRST so login page knows not to auto-redirect
    sessionStorage.setItem('aayam_signing_out', 'true');

    // 0. Fire attendance logout (non-blocking, best effort)
    try { await fetch('/api/attendance/logout', { method: 'POST' }); } catch (e) { }

    // 1. Perform Supabase signout FIRST (before clearing local state)
    if (isConfigured) {
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: 'global' }),
          new Promise(resolve => setTimeout(resolve, 5000)) // 5s timeout
        ]);
      } catch (e) {
        console.error('SignOut API error:', e);
      }
    }

    // 2. Clear ALL auth-related local storage AFTER signout completes
    localStorage.removeItem('aayam_fallback_profile');
    localStorage.removeItem('aayam_speed_role');
    localStorage.removeItem('aayam_bypass_mode');
    localStorage.removeItem('gdrive_connecting');

    // Clear any Supabase-specific storage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage (except our signing_out flag)
    const signingOut = sessionStorage.getItem('aayam_signing_out');
    sessionStorage.clear();
    if (signingOut) sessionStorage.setItem('aayam_signing_out', 'true');

    // Clear NextAuth and Supabase cookies (SSR uses cookies for auth)
    document.cookie.split(';').forEach(c => {
      const name = c.split('=')[0].trim();
      if (
        name.startsWith('next-auth') ||
        name.startsWith('__Secure-next-auth') ||
        name.startsWith('sb-') ||
        name.startsWith('supabase')
      ) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
      }
    });

    // 3. Clear React state
    setSession(null);
    setUser(null);
    setProfile(null);

    // 4. Force Navigation AFTER everything is cleared
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!isConfigured || !user) {
      return { error: 'Cannot update profile in demo mode' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) return { error: error.message };

      // Refresh profile
      await fetchProfile(user.id, user.email);
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    }
  };

  // Check if user has specific role(s)
  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!profile) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(profile.role);
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    isConfigured,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile: async () => {
      if (user) await fetchProfile(user.id, user.email);
    },
    hasRole,
    isAdmin: profile?.role === 'admin',
    isManager: hasRole(['admin', 'manager']),
    isDesigner: hasRole(['admin', 'manager', 'designer']),
    isFinance: hasRole(['admin', 'finance']),
    bypassLogin: () => {
      const bypassedProfile: Profile = {
        id: 'bypass-admin',
        email: 'admin@aayam.com',
        full_name: 'Emergency Admin',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString()
      };
      localStorage.setItem('aayam_bypass_mode', 'true');
      localStorage.setItem('aayam_fallback_profile', JSON.stringify(bypassedProfile));
      setProfile(bypassedProfile);
      setUser({ id: 'bypass-admin', email: 'admin@aayam.com', role: 'authenticated' } as User);
      window.location.href = '/admin/dashboard';
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles?: UserRole[]
) {
  return function WithAuthComponent(props: P) {
    const { profile, loading, hasRole } = useAuth();

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    if (!profile) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    if (allowedRoles && !hasRole(allowedRoles)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-500 mt-2">You don&apos;t have permission to view this page.</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
