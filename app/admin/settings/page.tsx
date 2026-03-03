'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { User, Shield, Briefcase, Mail, Phone, Trash2, Plus, X } from 'lucide-react';

// Define Profile interface locally if not updated globally
interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'marketing' | 'designer' | 'dispatch' | 'finance';
  is_active: boolean;
  created_at?: string;
}


import DesignersManager from '@/components/settings/DesignersManager';
import ProductionSettings from './production/page';
import GoogleDriveSettings from '@/components/settings/GoogleDriveSettings';
import VendorCategoriesManager from '@/components/settings/VendorCategoriesManager';
import ProductCategoriesManager from '@/components/settings/ProductCategoriesManager';

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'designers' | 'production' | 'drive' | 'vendor-categories' | 'product-categories'>('users');

  // ... (existing state for Users) ...
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    username: '',
    password: '',
    role: 'user'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  // ... (existing fetchProfiles, handleRoleChange, handleCreateUser) ...

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setProfiles(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error(String('Error updating role: ' + error.message));
    } else {
      await fetchProfiles();
    }
    setUpdating(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreationError(null);

    const email = `${newUser.username.toLowerCase().replace(/\s/g, '')}@aayam.local`;

    try {
      const tempSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { data, error } = await tempSupabase.auth.signUp({
        email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.fullName,
            role: newUser.role,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast.success(`User created successfully!\n\nID: ${newUser.username}\nPass: ${newUser.password}`);
        setShowAddModal(false);
        setNewUser({ fullName: '', username: '', password: '', role: 'user' });
        setTimeout(fetchProfiles, 1000);
      }
    } catch (err: any) {
      console.error('Creation error:', err);
      setCreationError(err.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const roles = ['admin', 'designer', 'marketing', 'dispatch', 'cmyk'];

  return (
    <div className="space-y-6">
      {/* Header Card - Stack on mobile, row on desktop */}
      <div className="bg-white p-4 md:p-4 rounded-md border space-y-4">
        {/* Title Section */}
        <div>
          <h1 className="text-xl md:text-page-title text-gray-900">Settings & Team</h1>
          <p className="text-gray-500 text-sm mt-1">Manage users, roles, and designer directory.</p>
        </div>

        {/* Tabs - Horizontal scroll on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex bg-gray-100 p-1 rounded-md min-w-max md:min-w-0">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users'
                ? 'bg-white text-primary'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Users & Roles
            </button>
            <button
              onClick={() => setActiveTab('designers')}
              className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'designers'
                ? 'bg-white text-primary'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Designers Directory
            </button>
            <button
              onClick={() => setActiveTab('production')}
              className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'production'
                ? 'bg-white text-orange-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Production
            </button>
            <button
              onClick={() => setActiveTab('drive')}
              className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'drive'
                ? 'bg-white text-foreground'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Google Drive
            </button>
            <button
              onClick={() => setActiveTab('vendor-categories')}
              className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'vendor-categories'
                ? 'bg-white text-foreground'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Vendor Categories
            </button>
            <button
              onClick={() => setActiveTab('product-categories')}
              className={`px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'product-categories'
                ? 'bg-white text-foreground'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Product Categories
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Add User Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold text-sm shadow-sm"
            >
              <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
              Add User
            </button>
          </div>

          {/* Users Table - Horizontal scroll on mobile */}
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="p-3 md:p-4 font-semibold text-gray-700 text-sm">User</th>
                    <th className="p-3 md:p-4 font-semibold text-gray-700 text-sm">Role</th>
                    <th className="p-3 md:p-4 font-semibold text-gray-700 text-sm">Status</th>
                    <th className="p-3 md:p-4 font-semibold text-gray-700 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading team...</td></tr>
                  ) : profiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 md:p-4">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {profile.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{profile.full_name}</p>
                            <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 md:p-4">
                        <select
                          value={profile.role}
                          disabled={updating === profile.id}
                          onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                          className="bg-white border border-gray-300 text-gray-900 text-xs md:text-sm rounded-md focus:ring-gray-400 focus:border-gray-400 block w-full p-2"
                        >
                          {roles.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold 
                        ${profile.is_active ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-700'}`}>
                          {profile.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {/* Delete or Suspend buttons could go here */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ADD USER MODAL */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-md  w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-section text-gray-900">Add New Team Member</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="p-4 space-y-4">
                  {creationError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                      {creationError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newUser.fullName}
                      onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username (Login ID)</label>
                    <div className="flex">
                      <input
                        type="text"
                        required
                        value={newUser.username}
                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                        className="w-full border border-gray-300 rounded-l-lg px-3 py-2 text-gray-900 focus:ring-gray-400 focus:border-gray-400"
                        placeholder="e.g. rahul"
                      />
                      <span className="bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg px-3 py-2 text-gray-500 text-sm flex items-center">
                        @aayam.local
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">This will be their login email.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:ring-gray-400 focus:border-gray-400"
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role / Department</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:ring-gray-400 focus:border-gray-400"
                    >
                      {roles.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-semibold disabled:opacity-50 shadow-sm"
                    >
                      {isCreating ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'designers' ? (
        <DesignersManager />
      ) : activeTab === 'production' ? (
        <ProductionSettings />
      ) : activeTab === 'vendor-categories' ? (
        <div className="bg-white p-4 md:p-6 rounded-md border">
          <VendorCategoriesManager />
        </div>
      ) : activeTab === 'product-categories' ? (
        <div className="bg-white p-4 md:p-6 rounded-md border">
          <ProductCategoriesManager />
        </div>
      ) : (
        <GoogleDriveSettings />
      )}
    </div>
  );
}
