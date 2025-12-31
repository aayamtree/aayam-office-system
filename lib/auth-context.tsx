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
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isDesigner: boolean;
  isFinance: boolean;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured] = useState<boolean>(isSupabaseConfigured());

  // Fetch user profile
  const fetchProfile = async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, create a basic one
        if (userEmail) {
          setProfile({
            id: userId,
            email: userEmail,
            full_name: userEmail.split('@')[0].toUpperCase(),
            role: 'admin',
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      } else {
        setProfile(data);
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

    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes - but don't cause flickering
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        // Only update on actual sign in/out events
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            await fetchProfile(session.user.id, session.user.email);
          } else {
            setProfile(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

  // Sign out
  const signOut = async () => {
    if (!isConfigured) {
      setProfile(null);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
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
    hasRole,
    isAdmin: profile?.role === 'admin',
    isManager: hasRole(['admin', 'manager']),
    isDesigner: hasRole(['admin', 'manager', 'designer']),
    isFinance: hasRole(['admin', 'finance']),
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
