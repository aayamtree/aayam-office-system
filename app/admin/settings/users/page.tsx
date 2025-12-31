'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, ArrowLeft, Edit, Trash2, X, Eye, EyeOff, User, Upload, Calendar, FolderOpen } from 'lucide-react';

interface UserAccount {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive';
  permissions: string[];
  idProofs: { type: string; image: string }[];
  lastLogin: string;
  createdAt: string;
}

const demoUsers: UserAccount[] = [
  { id: '1', name: 'Admin User', phone: '9876543210', role: 'Admin', status: 'active', permissions: ['all'], idProofs: [], lastLogin: '2024-12-25 10:30', createdAt: '2024-01-01' },
  { id: '2', name: 'Rahul Patel', phone: '9876543211', role: 'Manager', status: 'active', permissions: ['sales', 'dispatch', 'crm'], idProofs: [{ type: 'Aadhar Card', image: '' }], lastLogin: '2024-12-25 09:15', createdAt: '2024-03-15' },
  { id: '3', name: 'Priya Shah', phone: '9876543212', role: 'Print Operator', status: 'active', permissions: ['cmyk', 'dispatch'], idProofs: [{ type: 'PAN Card', image: '' }], lastLogin: '2024-12-24 18:00', createdAt: '2024-06-20' },
  { id: '4', name: 'Amit Kumar', phone: '9876543213', role: 'Accountant', status: 'active', permissions: ['finance', 'reports'], idProofs: [{ type: 'Aadhar Card', image: '' }, { type: 'PAN Card', image: '' }], lastLogin: '2024-12-25 11:00', createdAt: '2024-04-10' },
  { id: '5', name: 'Neha Sharma', phone: '9876543214', role: 'Delivery Boy', status: 'inactive', permissions: ['dispatch'], idProofs: [{ type: 'Driving License', image: '' }], lastLogin: '2024-12-20 14:30', createdAt: '2024-08-05' },
];

const permissionsList = ['dashboard', 'crm', 'sales', 'finance', 'dispatch', 'cmyk', 'reports', 'settings'];
const idProofTypes = ['Aadhar Card', 'PAN Card', 'Driving License', 'Voter ID', 'Passport'];

export default function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>(demoUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    role: '',
    customRole: '',
    status: 'active' as UserAccount['status'],
    permissions: [] as string[],
    idProofs: [] as { type: string; image: string }[],
  });

  const [newIdType, setNewIdType] = useState('');

  const filteredUsers = users.filter(user => {
    return user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const existingRoles = Array.from(new Set(users.map(u => u.role)));

  const handleAddNew = () => {
    setFormData({ name: '', phone: '', password: '', role: '', customRole: '', status: 'active', permissions: [], idProofs: [] });
    setNewIdType('');
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (user: UserAccount) => {
    setFormData({
      name: user.name,
      phone: user.phone,
      password: '',
      role: user.role,
      customRole: '',
      status: user.status,
      permissions: user.permissions,
      idProofs: user.idProofs || [],
    });
    setNewIdType('');
    setSelectedUser(user);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleView = (user: UserAccount) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this user?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const handleIdProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && newIdType) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          idProofs: [...prev.idProofs, { type: newIdType, image: reader.result as string }]
        }));
        setNewIdType('');
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIdProof = (index: number) => {
    setFormData(prev => ({
      ...prev,
      idProofs: prev.idProofs.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = formData.customRole || formData.role;
    if (!finalRole) {
      alert('Please select or enter a role');
      return;
    }

    if (isEditing && selectedUser) {
      setUsers(users.map(u =>
        u.id === selectedUser.id
          ? { ...u, name: formData.name, phone: formData.phone, role: finalRole, status: formData.status, permissions: formData.permissions, idProofs: formData.idProofs, lastLogin: u.lastLogin, createdAt: u.createdAt }
          : u
      ));
    } else {
      const newUser: UserAccount = {
        id: Date.now().toString(),
        name: formData.name,
        phone: formData.phone,
        role: finalRole,
        status: formData.status,
        permissions: formData.permissions,
        idProofs: formData.idProofs,
        lastLogin: '-',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setUsers([newUser, ...users]);
    }
    setShowModal(false);
  };

  const toggleStatus = (id: string) => {
    setUsers(users.map(u =>
      u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
    ));
  };

  const openGoogleDrive = () => {
    window.open('https://drive.google.com', '_blank');
  };

  const openGoogleCalendar = () => {
    window.open('https://calendar.google.com', '_blank');
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500">{users.length} user accounts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openGoogleCalendar}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100"
          >
            <Calendar size={18} />
            <span className="hidden sm:inline">Calendar</span>
          </button>
          <button
            onClick={openGoogleDrive}
            className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100"
          >
            <FolderOpen size={18} />
            <span className="hidden sm:inline">Drive</span>
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800"
          >
            <Plus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Google Integration Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-amber-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Google Integration</h3>
            <p className="text-sm text-gray-600">Store ID proofs in Drive, manage schedules in Calendar</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openGoogleDrive}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm"
            >
              <FolderOpen size={16} className="text-amber-600" />
              <span>Open Drive</span>
            </button>
            <button
              onClick={openGoogleCalendar}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm"
            >
              <Calendar size={16} className="text-blue-600" />
              <span>Open Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-600 font-medium">Active</p>
          <p className="text-2xl font-bold text-green-700">{users.filter(u => u.status === 'active').length}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-600 font-medium">Inactive</p>
          <p className="text-2xl font-bold text-gray-700">{users.filter(u => u.status === 'inactive').length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs text-blue-600 font-medium">Roles</p>
          <p className="text-2xl font-bold text-blue-700">{existingRoles.length}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <p className="text-xs text-purple-600 font-medium">Total Users</p>
          <p className="text-2xl font-bold text-purple-700">{users.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User size={24} className="text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                      {user.role}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {user.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">📞 {user.phone}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>Last login: {user.lastLogin}</span>
                    {user.idProofs && user.idProofs.length > 0 && (
                      <span>• IDs: {user.idProofs.map(p => p.type).join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(user.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${user.status === 'active'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                >
                  {user.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleView(user)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <Eye size={18} />
                </button>
                <button onClick={() => handleEdit(user)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isEditing ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!isEditing}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value, customRole: '' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  >
                    <option value="">Select Role</option>
                    {existingRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                    <option value="__custom__">+ Add New Role</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Custom Role Input */}
              {formData.role === '__custom__' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Role Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customRole}
                    onChange={(e) => setFormData({ ...formData, customRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                    placeholder="e.g. Designer, Packer, Driver"
                  />
                </div>
              )}

              {/* ID Proofs - Multiple */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Identity Documents</label>

                {/* Uploaded IDs List */}
                {formData.idProofs.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {formData.idProofs.map((proof, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-green-50 border border-green-200 rounded-xl">
                        {proof.image && (
                          <img src={proof.image} alt={proof.type} className="w-12 h-12 object-cover rounded-lg" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-green-700 text-sm">{proof.type}</p>
                          <p className="text-xs text-green-600">✓ Uploaded</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeIdProof(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New ID Proof */}
                <div className="p-3 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-500 mb-2">Add Identity Document</p>
                  <div className="flex gap-2">
                    <select
                      value={newIdType}
                      onChange={(e) => setNewIdType(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    >
                      <option value="">Select Document Type</option>
                      {idProofTypes.filter(type => !formData.idProofs.some(p => p.type === type)).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <label className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer ${newIdType ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}>
                      <Upload size={16} />
                      <span className="text-sm">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIdProofUpload}
                        className="hidden"
                        disabled={!newIdType}
                      />
                    </label>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  💡 Store backup in <button type="button" onClick={openGoogleDrive} className="text-blue-600 underline">Google Drive</button>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {permissionsList.map(perm => (
                    <button
                      key={perm}
                      type="button"
                      onClick={() => togglePermission(perm)}
                      className={`px-3 py-1.5 rounded-lg text-sm capitalize ${formData.permissions.includes(perm) || formData.permissions.includes('all')
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {perm}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800">
                  {isEditing ? 'Update' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">User Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User size={32} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedUser.name}</h3>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Phone</span>
                  <a href={`tel:${selectedUser.phone}`} className="font-medium text-indigo-600">{selectedUser.phone}</a>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${selectedUser.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                    {selectedUser.status}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Last Login</span>
                  <span className="font-medium text-gray-900">{selectedUser.lastLogin}</span>
                </div>
                {selectedUser.idProofs && selectedUser.idProofs.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-500 text-sm">Identity Documents ({selectedUser.idProofs.length})</span>
                    <div className="space-y-2 mt-2">
                      {selectedUser.idProofs.map((proof, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                          {proof.image && (
                            <img src={proof.image} alt={proof.type} className="w-16 h-16 object-cover rounded-lg" />
                          )}
                          <span className="font-medium text-gray-900">{proof.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-500 text-sm">Permissions</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedUser.permissions.map(perm => (
                      <span key={perm} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded capitalize">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
