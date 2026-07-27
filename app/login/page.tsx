'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Lock, User, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { logLogin } from '@/lib/activity-logger';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, profile, session, loading, isConfigured } = useAuth();
  const hasRedirected = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [isNewDay, setIsNewDay] = useState(false);

  // Detect new-day redirect (forced re-login for attendance)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'new_day') {
      setIsNewDay(true);
    }
  }, []);

  // Detect localhost after mount to avoid hydration mismatch
  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }, []);

  // Clear the signing_out flag shortly after login page mounts
  // (delay ensures the redirect-guard useEffect reads the flag first)
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem('aayam_signing_out');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already logged in — requires REAL session to avoid redirect loops
  // (stale cached profiles without a session would cause middleware to bounce back to /login)
  useEffect(() => {
    // Don't auto-redirect if user just signed out
    const justSignedOut = sessionStorage.getItem('aayam_signing_out') === 'true';
    if (justSignedOut) return;

    if (!loading && profile && session && !hasRedirected.current) {
      hasRedirected.current = true;
      const target = profile.role === 'designer' ? '/admin/designers/tasks'
        : profile.role === 'dispatch' ? '/admin/dispatch'
          : profile.role === 'marketing' ? '/admin/marketing'
            : profile.role === 'cmyk' ? '/admin/cmyk-print'
              : '/admin/dashboard';
      router.push(target);
    }
  }, [profile, session, loading, router]);

  // SECURITY 2026-07-27: the Ctrl+Shift+L "quick login" shortcut and its
  // matching button were removed along with bypassLogin(). They handed out an
  // admin profile with no server check. The localhost guard was client-side
  // only, and the localStorage flag it set (aayam_bypass_mode) was honoured
  // everywhere, including production. Sign in with a real account instead.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Safety timeout: reset loading after 30s if something gets stuck
    // (Vercel preview cold starts can take 10-20s on first request)
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      setError('Login timed out. Please try again.');
    }, 30000);

    try {
      // Convert username to internal email format
      const cleanInput = email.trim().toLowerCase();
      const loginEmail = cleanInput.includes('@')
        ? cleanInput
        : `${cleanInput}@aayam.internal`;

      const { error: signInError } = await signIn(loginEmail, password);

      if (signInError) {
        clearTimeout(safetyTimer);
        console.error('Sign in error:', signInError);
        const errorMessage = typeof signInError === 'string'
          ? signInError
          : (signInError as any).message || 'Invalid username or password';
        setError(errorMessage);
        setIsLoading(false);
      } else {
        clearTimeout(safetyTimer);
        // Fire-and-forget: don't block redirect waiting for activity log
        logLogin().catch(console.error);
        // Redirect immediately — don't wait for profile state to update
        window.location.href = '/admin/dashboard';
      }
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error('Login exception:', err);
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  // Already logged in — show the login form (redirect happens silently via useEffect above)
  // No loading/blank gates — form renders INSTANTLY, no flicker

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <Image src="/company-logo.png" alt="Aayam" width={80} height={80} className="mx-auto mb-4" />
          <h1 className="text-page-title text-gray-900">Aayam Office</h1>
          <p className="text-body text-gray-600 mt-1">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {isNewDay && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3 mb-2">
              <Clock className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-semibold text-blue-800">Good morning! 🌅</p>
                <p className="text-xs text-blue-600 mt-0.5">Please sign in to record your attendance for today. Office hours: 9:00 AM – 7:30 PM</p>
              </div>
            </div>
          )}
          {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className="form-label">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="designer1, admin1, etc."
                  required
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>
              <p className="text-label text-gray-500 mt-1">Enter your username only (no email needed)</p>
            </div>

            <div>
              <label className="form-label">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-body text-primary hover:opacity-80 font-medium">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 rounded-md font-semibold focus:ring-4 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-body text-gray-500">
              Need help? Contact your system administrator.
            </p>
          </div>
        </div>


        {/* Footer */}
        <div className="text-center mt-3 md:mt-6">
          <p className="text-label text-gray-500">
            © 2026 Aayam Creative. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
