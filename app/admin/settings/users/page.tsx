'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { Pencil } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'marketing' | 'designer' | 'dispatch' | 'account' | 'finance' | 'cmyk' | 'user';
  is_active: boolean;
  can_design: boolean;
  created_at?: string;
}

export default function UserManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (data) setProfiles(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId);
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) toast.error('Error updating role: ' + error.message);
    else await fetchProfiles();
    setUpdating(null);
  };

  const handleCanDesignToggle = async (userId: string, current: boolean) => {
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ can_design: !current })
      .eq('id', userId);
    if (error) {
      toast.error('Error updating: ' + error.message);
    } else {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, can_design: !current } : p));
    }
    setUpdating(null);
  };

  const roles = ['admin', 'marketing', 'designer', 'dispatch', 'finance', 'cmyk', 'user'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-page-title text-gray-900">Team Management</h1>
          <p className="text-gray-500">Assign roles and manage access for your employees.</p>
        </div>
        <div className="text-sm text-gray-500 bg-muted p-2 rounded border border-yellow-200">
          Note: To add a new user, ask them to Sign Up, then assign their role here.
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-semibold text-gray-700">User</th>
              <th className="p-4 font-semibold text-gray-700">Role</th>
              <th className="p-4 font-semibold text-gray-700 text-center">Can Design</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center">Loading team...</td></tr>
            ) : profiles.filter(p => p.full_name).map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {profile.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{profile.full_name}</p>
                      <p className="text-sm text-gray-500">{profile.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <select
                    value={profile.role}
                    disabled={updating === profile.id}
                    onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-gray-400 focus:border-gray-400 block w-full p-2.5"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => handleCanDesignToggle(profile.id, profile.can_design)}
                    disabled={updating === profile.id}
                    title={profile.can_design ? 'Remove from designer dropdown' : 'Add to designer dropdown'}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                      ${profile.can_design ? 'bg-blue-600' : 'bg-gray-200'}
                      ${updating === profile.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                        ${profile.can_design ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold
                    ${profile.is_active ? 'bg-gray-100 text-gray-900' : 'bg-red-100 text-red-700'}`}>
                    {profile.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        <strong>Can Design</strong> — when enabled, this person appears in the Designer dropdown on jobs regardless of their role.
        Use this for admins like Eklavya or Satish who also do design work.
      </p>
    </div>
  );
}
