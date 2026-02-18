'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { logLogin } from '@/lib/activity-logger';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, profile, loading, isConfigured, bypassLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in - Optimized for Role
  useEffect(() => {
    if (!loading && profile) {
      const target = profile.role === 'designer' ? '/admin/designers/tasks'
        : profile.role === 'dispatch' ? '/admin/dispatch'
          : profile.role === 'marketing' ? '/admin/marketing'
            : profile.role === 'cmyk' ? '/admin/cmyk-print'
              : '/admin/dashboard';
      // Use window.location for instant navigation (faster than router.push)
      window.location.href = target;
    }
  }, [profile, loading]);

  // Keyboard shortcut for quick login (localhost only)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          e.preventDefault();
          console.log('🚀 BYPASS LOGIN - Keyboard Shortcut (Ctrl+Shift+L)');
          bypassLogin();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [bypassLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Safety timeout: reset loading after 8s if something gets stuck
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      setError('Login timed out. Please try again.');
    }, 8000);

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
        // Fire-and-forget: don't block redirect waiting for activity log
        logLogin().catch(console.error);
        console.log('Sign in successful — redirecting...');
        // Redirect is handled by useEffect watching profile
      }
    } catch (err: any) {
      clearTimeout(safetyTimer);
      console.error('Login exception:', err);
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  // Don't block — show the form immediately, handle redirect silently
  if (!loading && profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-2">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oms-blue"></div>
        <p className="text-gray-500 text-body">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <img src="/company-logo.png" alt="Aayam" className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-page-title text-gray-900">Aayam Office</h1>
          <p className="text-body text-gray-600 mt-1">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oms-blue/20 focus:border-oms-blue transition-all"
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
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-oms-blue/20 focus:border-oms-blue transition-all"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-oms-blue focus:ring-oms-blue" />
                <span className="text-body text-gray-600">Remember me</span>
              </label>
              <button type="button" className="text-body text-oms-blue hover:opacity-80 font-medium">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-white rounded-md font-semibold focus:ring-4 focus:ring-oms-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Localhost Quick Login - Only visible on localhost */}
        {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
          <div className="text-center mt-4">
            <button
              onClick={() => {
                console.log('🚀 BYPASS LOGIN - Localhost Testing Mode');
                bypassLogin();
              }}
              className="px-4 py-2 bg-oms-orange text-white rounded-lg text-sm font-semibold hover:bg-oms-orange/90 transition-colors"
            >
              ⚡ Quick Login (Localhost Only)
            </button>
            <p className="text-xs text-gray-400 mt-2">Or press Ctrl+Shift+L</p>
          </div>
        )}

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
