'use client';

import { useState, useEffect, Fragment } from 'react';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { Pencil, Send, CheckCircle2, XCircle, Copy } from 'lucide-react';

interface LinkCandidate {
  telegram_chat_id: string;
  telegram_username: string | null;
  first_name: string | null;
  last_department: string | null;
  message_count: number;
  last_seen_at: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'marketing' | 'designer' | 'dispatch' | 'account' | 'finance' | 'cmyk' | 'user';
  is_active: boolean;
  can_design: boolean;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_linked_at?: string | null;
  created_at?: string;
  // HR fields — these used to be editable only in Settings → Designers
  // Directory, which read the SAME profiles row. One table, two doors, and no
  // way to tell which one owned what. They live here now.
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  skills?: string[] | null;
  employment_type?: string | null;
  hourly_rate?: number | null;
  monthly_salary?: number | null;
  joining_date?: string | null;
}

const EMPTY_EDIT = {
  full_name: '', phone: '', city: '', state: '',
  employment_type: 'full-time', hourly_rate: '', monthly_salary: '',
  joining_date: '', skills: '',
};

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

  // ── Telegram users seen in the department groups but not yet matched ──
  // A bot cannot message anyone by phone number; their Telegram id is the only
  // usable handle, and it arrives free every time they type in a group. The
  // webhook parks those ids; here an admin attaches each to the right person.
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busyCandidate, setBusyCandidate] = useState<string | null>(null);

  const fetchCandidates = async () => {
    const res = await fetch('/api/telegram/link-candidates');
    if (!res.ok) return;
    const json = await res.json();
    setCandidates(json.data || []);
  };

  useEffect(() => { fetchCandidates(); }, []);

  const resolveCandidate = async (chatId: string, action: 'link' | 'ignore') => {
    const profileId = pick[chatId];
    if (action === 'link' && !profileId) {
      toast.error('Choose which staff member this is first');
      return;
    }
    setBusyCandidate(chatId);
    const res = await fetch('/api/telegram/link-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_chat_id: chatId, action, profile_id: profileId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error || 'Could not update');
    } else {
      toast.success(action === 'link' ? 'Linked — they will be @mentioned from now on' : 'Dismissed');
      await Promise.all([fetchCandidates(), fetchProfiles()]);
    }
    setBusyCandidate(null);
  };

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

  const generateTelegramLink = (userId: string) => {
    return `https://t.me/aayam_notify_bot?start=staff_${userId}`;
  };

  const copyTelegramLink = async (userId: string, userName: string) => {
    const link = generateTelegramLink(userId);
    await navigator.clipboard.writeText(link);
    toast.success(`Telegram link copied for ${userName}! Send via WhatsApp.`);
  };

  const unlinkTelegram = async (userId: string, userName: string) => {
    if (!confirm(`Unlink Telegram for ${userName}?`)) return;
    setUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ 
        telegram_chat_id: null,
        telegram_username: null,
        telegram_linked_at: null 
      })
      .eq('id', userId);
    if (error) {
      toast.error('Error unlinking: ' + error.message);
    } else {
      await fetchProfiles();
      toast.success('Telegram unlinked!');
    }
    setUpdating(null);
  };

  const roles = ['admin', 'marketing', 'designer', 'dispatch', 'finance', 'cmyk', 'user'];

  const unlinked = profiles.filter(p => !p.telegram_chat_id && p.is_active);

  // ── Person editor (contact + employment) ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ ...EMPTY_EDIT });
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditor = (p: Profile) => {
    if (editingId === p.id) { setEditingId(null); return; }
    setEditingId(p.id);
    setEdit({
      full_name: p.full_name || '',
      phone: p.phone || '',
      city: p.city || '',
      state: p.state || '',
      employment_type: p.employment_type || 'full-time',
      hourly_rate: p.hourly_rate != null ? String(p.hourly_rate) : '',
      monthly_salary: p.monthly_salary != null ? String(p.monthly_salary) : '',
      joining_date: p.joining_date || '',
      skills: (p.skills || []).join(', '),
    });
  };

  const saveEditor = async (id: string) => {
    setSavingEdit(true);
    const { error } = await supabase.from('profiles').update({
      full_name: edit.full_name.trim() || null,
      phone: edit.phone.trim() || null,
      city: edit.city.trim() || null,
      state: edit.state.trim() || null,
      employment_type: edit.employment_type || null,
      // Empty box means "not set", not zero — a blank rate should never be
      // saved as ₹0/hr and quietly used in costing.
      hourly_rate: edit.hourly_rate.trim() === '' ? null : Number(edit.hourly_rate),
      monthly_salary: edit.monthly_salary.trim() === '' ? null : Number(edit.monthly_salary),
      joining_date: edit.joining_date || null,
      skills: edit.skills.split(',').map(s => s.trim()).filter(Boolean),
    }).eq('id', id);
    if (error) toast.error('Could not save: ' + error.message);
    else {
      toast.success('Saved');
      setEditingId(null);
      await fetchProfiles();
    }
    setSavingEdit(false);
  };

  const toggleActive = async (p: Profile) => {
    setUpdating(p.id);
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) toast.error('Could not update: ' + error.message);
    else await fetchProfiles();
    setUpdating(null);
  };

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const visible = profiles
    .filter(p => p.full_name)
    .filter(p => roleFilter === 'all' || p.role === roleFilter)
    .filter(p => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [p.full_name, p.email, p.phone, p.city, (p.skills || []).join(' ')]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });

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

      {candidates.length > 0 && (
        <div className="bg-white rounded-md border border-blue-200 overflow-hidden">
          <div className="border-b border-blue-100 bg-blue-50 px-4 py-3">
            <h2 className="font-semibold text-gray-900">Seen in your Telegram groups</h2>
            <p className="text-sm text-gray-600">
              These people are posting in a department group but aren&apos;t matched to a staff
              account yet, so alerts can only show their name — not notify them. Tell the app who
              each one is and they&apos;ll start getting real @mentions and their personal daily brief.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {candidates.map(c => (
              <div key={c.telegram_chat_id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">
                    {c.first_name || 'Telegram user'}
                    {c.telegram_username && (
                      <span className="ml-2 text-sm text-gray-500">@{c.telegram_username}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.message_count} message{c.message_count === 1 ? '' : 's'}
                    {c.last_department ? ` in ${c.last_department}` : ''} · last seen{' '}
                    {new Date(c.last_seen_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>

                <select
                  value={pick[c.telegram_chat_id] || ''}
                  onChange={e => setPick(prev => ({ ...prev, [c.telegram_chat_id]: e.target.value }))}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">This is…</option>
                  {unlinked.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={busyCandidate === c.telegram_chat_id}
                  onClick={() => resolveCandidate(c.telegram_chat_id, 'link')}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busyCandidate === c.telegram_chat_id ? 'Linking…' : 'Link'}
                </button>
                <button
                  type="button"
                  disabled={busyCandidate === c.telegram_chat_id}
                  onClick={() => resolveCandidate(c.telegram_chat_id, 'ignore')}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Not staff
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, city, skill…"
          className="min-w-[240px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All roles ({profiles.filter(p => p.full_name).length})</option>
          {roles.map(r => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)} ({profiles.filter(p => p.role === r && p.full_name).length})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-semibold text-gray-700">User</th>
              <th className="p-4 font-semibold text-gray-700">Role</th>
              <th className="p-4 font-semibold text-gray-700 text-center">Can Design</th>
              <th className="p-4 font-semibold text-gray-700">Telegram</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center">Loading team...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nobody matches that.</td></tr>
            ) : visible.map((profile) => (
              <Fragment key={profile.id}>
              <tr className="hover:bg-gray-50 transition-colors">
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
                  {profile.telegram_chat_id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-medium">Linked</span>
                      </div>
                      {profile.telegram_username && (
                        <span className="text-xs text-gray-500">@{profile.telegram_username}</span>
                      )}
                      <button
                        onClick={() => unlinkTelegram(profile.id, profile.full_name)}
                        disabled={updating === profile.id}
                        className="text-xs text-red-600 hover:text-red-700 underline"
                      >
                        unlink
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => copyTelegramLink(profile.id, profile.full_name)}
                      disabled={updating === profile.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-medium transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Get Link
                    </button>
                  )}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => toggleActive(profile)}
                    disabled={updating === profile.id}
                    title={profile.is_active ? 'Suspend — hides them from pickers, keeps their history' : 'Reactivate'}
                    className={`px-2 py-1 rounded-md text-xs font-bold disabled:opacity-50
                      ${profile.is_active ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                    {profile.is_active ? 'Active' : 'Suspended'}
                  </button>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => openEditor(profile)}
                    className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {editingId === profile.id ? 'Close' : 'Details'}
                  </button>
                </td>
              </tr>

              {editingId === profile.id && (
                <tr className="bg-gray-50">
                  <td colSpan={6} className="p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Full name</span>
                        <input value={edit.full_name} onChange={e => setEdit({ ...edit, full_name: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Phone</span>
                        <input value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Employment</span>
                        <select value={edit.employment_type} onChange={e => setEdit({ ...edit, employment_type: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2">
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="freelance">Freelance</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">City</span>
                        <input value={edit.city} onChange={e => setEdit({ ...edit, city: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">State</span>
                        <input value={edit.state} onChange={e => setEdit({ ...edit, state: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Joining date</span>
                        <input type="date" value={edit.joining_date} onChange={e => setEdit({ ...edit, joining_date: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Rate ₹/hr</span>
                        <input type="number" min="0" value={edit.hourly_rate} onChange={e => setEdit({ ...edit, hourly_rate: e.target.value })}
                          placeholder="not set"
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Monthly salary ₹</span>
                        <input type="number" min="0" value={edit.monthly_salary} onChange={e => setEdit({ ...edit, monthly_salary: e.target.value })}
                          placeholder="not set"
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Skills</span>
                        <input value={edit.skills} onChange={e => setEdit({ ...edit, skills: e.target.value })}
                          placeholder="Packaging, Social Media, Logo Design"
                          className="w-full rounded-md border border-gray-300 px-3 py-2" />
                        <span className="mt-1 block text-xs text-gray-500">Separate with commas</span>
                      </label>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button onClick={() => saveEditor(profile.id)} disabled={savingEdit}
                        className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-white">
                        Cancel
                      </button>
                      <span className="text-xs text-gray-500">
                        Role, access and Telegram are on the row above — same record, saved instantly.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 text-xs text-gray-400">
        <p>
          <strong>Can Design</strong> — when enabled, this person appears in the Designer dropdown on jobs regardless of their role.
          Use this for admins like Eklavya or Satish who also do design work.
        </p>
        <p>
          <strong>Telegram Linking</strong> — Click &quot;Get Link&quot; to copy the Telegram linking URL. Send it to the staff member via WhatsApp.
          When they tap it and press Start in Telegram, their account will be linked automatically.
        </p>
      </div>
    </div>
  );
}
