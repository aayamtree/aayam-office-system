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
      if (profile.role === 'designer') {
        router.push('/admin/designers/tasks');
      } else if (profile.role === 'dispatch') {
        router.push('/admin/dispatch');
      } else if (profile.role === 'marketing') {
        router.push('/admin/marketing');
      } else if (profile.role === 'cmyk') {
        router.push('/admin/cmyk-print');
      } else {
        // Admin only
        router.push('/admin/dashboard');
      }
    }
  }, [profile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Convert username to internal email format
      const cleanInput = email.trim().toLowerCase();
      const loginEmail = cleanInput.includes('@')
        ? cleanInput
        : `${cleanInput}@aayam.internal`;

      const { error: signInError } = await signIn(loginEmail, password);

      if (signInError) {
        console.error('Sign in error:', signInError);
        const errorMessage = typeof signInError === 'string'
          ? signInError
          : (signInError as any).message || 'Invalid username orpassword';
        setError(errorMessage);
        setIsLoading(false);
      } else {
        // Log successful login
        await logLogin();
        console.log('Sign in successful (Waiting for redirect)...');
        // Redirect handled by useEffect
      }
    } catch (err: any) {
      console.error('Login exception:', err);
      setError(err.message || 'An error occurred');
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-oms-blue"></div>
        <p className="text-gray-500 text-body">Initializing...</p>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="text-xs text-oms-blue hover:underline mt-4"
        >
          Stuck? Click to reset application
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-oms-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <h1 className="text-page-title text-gray-900">Aayam Office</h1>
          <p className="text-body text-gray-600 mt-1">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
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
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-oms-blue/20 focus:border-oms-blue transition-all"
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
                  className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-oms-blue/20 focus:border-oms-blue transition-all"
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
              className="btn-primary w-full py-3 text-white rounded-xl font-semibold focus:ring-4 focus:ring-oms-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="text-center mt-6">
          <p className="text-label text-gray-500">
            © 2026 Aayam Creative. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
