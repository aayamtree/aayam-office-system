'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, CheckCircle,
  AlertCircle, User, Briefcase, MessageSquare, Paperclip, ExternalLink,
  FileText, Image, Video, Music, File, ChevronDown, ArrowRight, RefreshCw
} from 'lucide-react';

const designers = [
  { id: 1, name: 'Rahul Sharma' },
  { id: 2, name: 'Priya Patel' },
  { id: 3, name: 'Amit Kumar' },
  { id: 4, name: 'Sneha Mehta' },
];

const clients = [
  { id: 1, name: 'Sharma Industries' },
  { id: 2, name: 'Royal Prints' },
  { id: 3, name: 'Gujarat Textiles' },
];

const jobs = [
  { id: 1, jobId: 'AAY-001', name: 'Wedding Cards' },
  { id: 2, jobId: 'AAY-002', name: 'Brochures' },
  { id: 3, jobId: 'AAY-003', name: 'Packaging Design' },
];

const taskStatuses = [
  { id: 'pending', name: 'Pending', color: 'bg-gray-100 text-gray-700' },
  { id: 'in_progress', name: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { id: 'review', name: 'Review', color: 'bg-purple-100 text-purple-700' },
  { id: 'rework', name: 'Rework', color: 'bg-orange-100 text-orange-700' },
  { id: 'completed', name: 'Completed', color: 'bg-green-100 text-green-700' },
];

const priorities = [
  { id: 'low', name: 'Low', color: 'bg-gray-100 text-gray-600' },
  { id: 'normal', name: 'Normal', color: 'bg-blue-100 text-blue-600' },
  { id: 'high', name: 'High', color: 'bg-orange-100 text-orange-600' },
  { id: 'urgent', name: 'Urgent', color: 'bg-red-100 text-red-600' },
];

const initialTasks = [
  { id: 1, taskId: 'TSK-001', title: 'Wedding Card Design - Main Design', description: 'Create main wedding card design with traditional motifs',
    assignedTo: 1, assignedName: 'Rahul Sharma', clientId: 1, clientName: 'Sharma Industries',
    jobId: 1, jobName: 'AAY-001 - Wedding Cards', status: 'in_progress', priority: 'high',
    startDate: '2025-12-20', deadline: '2025-12-28', estimatedHours: 8,
    attachments: [
      { name: 'reference_design.jpg', type: 'image', url: '#', size: '2.5 MB' },
      { name: 'client_brief.pdf', type: 'pdf', url: '#', size: '1.2 MB' },
    ],
    remarks: [
      { by: 'Admin', date: '2025-12-20', text: 'Use gold and red theme as per client preference' },
      { by: 'Rahul Sharma', date: '2025-12-21', text: 'Started with initial concepts, will share by EOD' },
    ],
    driveLink: 'https://drive.google.com/folder/abc123',
    createdAt: '2025-12-20' },
  { id: 2, taskId: 'TSK-002', title: 'Brochure Layout - 8 Pages', description: 'Design 8-page company brochure with product details',
    assignedTo: 2, assignedName: 'Priya Patel', clientId: 2, clientName: 'Royal Prints',
    jobId: 2, jobName: 'AAY-002 - Brochures', status: 'review', priority: 'normal',
    startDate: '2025-12-18', deadline: '2025-12-26', estimatedHours: 12,
    attachments: [
      { name: 'brochure_v1.ai', type: 'design', url: '#', size: '45 MB' },
      { name: 'product_images.zip', type: 'file', url: '#', size: '120 MB' },
    ],
    remarks: [
      { by: 'Admin', date: '2025-12-18', text: 'Follow brand guidelines strictly' },
      { by: 'Priya Patel', date: '2025-12-24', text: 'Completed first draft, ready for review' },
    ],
    driveLink: 'https://drive.google.com/folder/def456',
    createdAt: '2025-12-18' },
  { id: 3, taskId: 'TSK-003', title: 'Product Packaging - Box Design', description: 'Create packaging box design for textile products',
    assignedTo: 3, assignedName: 'Amit Kumar', clientId: 3, clientName: 'Gujarat Textiles',
    jobId: 3, jobName: 'AAY-003 - Packaging Design', status: 'pending', priority: 'urgent',
    startDate: '2025-12-25', deadline: '2025-12-30', estimatedHours: 10,
    attachments: [],
    remarks: [],
    driveLink: '',
    createdAt: '2025-12-25' },
  { id: 4, taskId: 'TSK-004', title: 'Envelope Design', description: 'Match envelope design with wedding card theme',
    assignedTo: 1, assignedName: 'Rahul Sharma', clientId: 1, clientName: 'Sharma Industries',
    jobId: 1, jobName: 'AAY-001 - Wedding Cards', status: 'pending', priority: 'normal',
    startDate: '2025-12-26', deadline: '2025-12-29', estimatedHours: 3,
    attachments: [],
    remarks: [
      { by: 'Admin', date: '2025-12-25', text: 'Start after main card design approval' },
    ],
    driveLink: '',
    createdAt: '2025-12-25' },
  { id: 5, taskId: 'TSK-005', title: 'Social Media Creatives', description: 'Create 5 social media posts for product launch',
    assignedTo: 2, assignedName: 'Priya Patel', clientId: 2, clientName: 'Royal Prints',
    jobId: null, jobName: 'Standalone Task', status: 'completed', priority: 'low',
    startDate: '2025-12-15', deadline: '2025-12-20', estimatedHours: 5,
    attachments: [
      { name: 'social_posts.psd', type: 'design', url: '#', size: '85 MB' },
    ],
    remarks: [
      { by: 'Priya Patel', date: '2025-12-20', text: 'All 5 posts completed and approved by client' },
    ],
    driveLink: 'https://drive.google.com/folder/ghi789',
    createdAt: '2025-12-15' },
];

export default function DesignerTasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [designerFilter, setDesignerFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskCounter, setTaskCounter] = useState(6);
  const [newRemark, setNewRemark] = useState('');
  const [transferTo, setTransferTo] = useState('');

  const [formData, setFormData] = useState({
    title: '', description: '', assignedTo: '', clientId: '', jobId: '',
    priority: 'normal', startDate: '', deadline: '', estimatedHours: 0, driveLink: ''
  });

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesDesigner = designerFilter === 'all' || t.assignedTo.toString() === designerFilter;
    return matchesSearch && matchesStatus && matchesDesigner;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const designer = designers.find(d => d.id.toString() === formData.assignedTo);
    const client = clients.find(c => c.id.toString() === formData.clientId);
    const job = jobs.find(j => j.id.toString() === formData.jobId);
    
    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? 
        { ...t, ...formData, assignedTo: parseInt(formData.assignedTo), assignedName: designer?.name || '',
          clientId: parseInt(formData.clientId), clientName: client?.name || '',
          jobId: formData.jobId ? parseInt(formData.jobId) : null, 
          jobName: job ? `${job.jobId} - ${job.name}` : 'Standalone Task' } : t));
    } else {
      const newTask = {
        id: Date.now(), taskId: `TSK-${String(taskCounter).padStart(3, '0')}`,
        ...formData, assignedTo: parseInt(formData.assignedTo), assignedName: designer?.name || '',
        clientId: parseInt(formData.clientId), clientName: client?.name || '',
        jobId: formData.jobId ? parseInt(formData.jobId) : null,
        jobName: job ? `${job.jobId} - ${job.name}` : 'Standalone Task',
        status: 'pending', attachments: [], remarks: [], createdAt: new Date().toISOString().split('T')[0]
      };
      setTasks([newTask, ...tasks]);
      setTaskCounter(taskCounter + 1);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', assignedTo: '', clientId: '', jobId: '',
      priority: 'normal', startDate: '', deadline: '', estimatedHours: 0, driveLink: '' });
    setEditingTask(null);
    setShowModal(false);
  };

  const handleEdit = (task: any) => {
    setFormData({ title: task.title, description: task.description, assignedTo: task.assignedTo.toString(),
      clientId: task.clientId.toString(), jobId: task.jobId?.toString() || '',
      priority: task.priority, startDate: task.startDate, deadline: task.deadline,
      estimatedHours: task.estimatedHours, driveLink: task.driveLink || '' });
    setEditingTask(task);
    setShowModal(true);
  };

  const handleStatusChange = (taskId: number, newStatus: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleAddRemark = () => {
    if (newRemark.trim() && selectedTask) {
      const remark = { by: 'Admin', date: new Date().toISOString().split('T')[0], text: newRemark };
      setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, remarks: [...t.remarks, remark] } : t));
      setSelectedTask({ ...selectedTask, remarks: [...selectedTask.remarks, remark] });
      setNewRemark('');
      setShowRemarkModal(false);
    }
  };

  const handleTransferTask = () => {
    if (transferTo && selectedTask) {
      const designer = designers.find(d => d.id.toString() === transferTo);
      const remark = { by: 'System', date: new Date().toISOString().split('T')[0], 
        text: `Task transferred from ${selectedTask.assignedName} to ${designer?.name}` };
      setTasks(tasks.map(t => t.id === selectedTask.id ? 
        { ...t, assignedTo: parseInt(transferTo), assignedName: designer?.name || '', remarks: [...t.remarks, remark] } : t));
      setShowTransferModal(false);
      setTransferTo('');
      setShowDetailModal(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this task?')) setTasks(tasks.filter(t => t.id !== id));
  };

  const getStatusBadge = (status: string) => taskStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';
  const getPriorityBadge = (priority: string) => priorities.find(p => p.id === priority)?.color || 'bg-gray-100 text-gray-600';

  const getFileIcon = (type: string) => {
    switch(type) {
      case 'image': return <Image size={16} className="text-blue-500" />;
      case 'video': return <Video size={16} className="text-red-500" />;
      case 'audio': return <Music size={16} className="text-purple-500" />;
      case 'pdf': return <FileText size={16} className="text-red-600" />;
      case 'design': return <File size={16} className="text-orange-500" />;
      default: return <File size={16} className="text-gray-500" />;
    }
  };

  const isOverdue = (deadline: string, status: string) => 
    status !== 'completed' && new Date(deadline) < new Date();

  // Stats
  const totalTasks = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/designers" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Design Tasks</h1>
            <p className="text-gray-500">Task & project management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/designers/projects"
            className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2.5 rounded-lg hover:bg-purple-200 font-medium">
            <Briefcase size={18} />
            <span className="hidden sm:inline">Projects</span>
          </Link>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
            <Plus size={18} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Tasks</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalTasks}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">In Progress</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{inProgress}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Pending</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Completed</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search tasks..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            {taskStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={designerFilter} onChange={(e) => setDesignerFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Designers</option>
            {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.map(task => (
          <div key={task.id} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
            task.priority === 'urgent' ? 'border-l-4 border-l-red-500' : 
            task.priority === 'high' ? 'border-l-4 border-l-orange-400' : 
            isOverdue(task.deadline, task.status) ? 'border-l-4 border-l-red-400' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-indigo-600 font-medium">{task.taskId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(task.status)}`}>
                    {taskStatuses.find(s => s.id === task.status)?.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadge(task.priority)}`}>
                    {task.priority}
                  </span>
                  {isOverdue(task.deadline, task.status) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                      <AlertCircle size={12} />Overdue
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">{task.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-1">{task.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-2">
                  <span className="flex items-center gap-1"><User size={14} />{task.assignedName}</span>
                  <span className="flex items-center gap-1"><Briefcase size={14} />{task.jobName}</span>
                  <span className="flex items-center gap-1"><Calendar size={14} />{new Date(task.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  {task.attachments.length > 0 && (
                    <span className="flex items-center gap-1"><Paperclip size={14} />{task.attachments.length} files</span>
                  )}
                  {task.remarks.length > 0 && (
                    <span className="flex items-center gap-1"><MessageSquare size={14} />{task.remarks.length}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={task.status} onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  className="text-sm px-2 py-1.5 border rounded-lg">
                  {taskStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => { setSelectedTask(task); setShowDetailModal(true); }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                <button onClick={() => handleEdit(task)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Edit size={18} /></button>
                <button onClick={() => handleDelete(task.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No tasks found</h3>
          <p className="mt-1 text-gray-500">Create tasks to assign to designers</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingTask ? 'Edit Task' : 'Create Task'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Task Title *</label>
                <input type="text" required value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" placeholder="Wedding Card Design" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" rows={2} placeholder="Task details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Assign To *</label>
                  <select required value={formData.assignedTo} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    <option value="">Select Designer</option>
                    {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Client *</label>
                  <select required value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Link to Job</label>
                  <select value={formData.jobId} onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    <option value="">Standalone Task</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.jobId} - {j.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Priority</label>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg">
                    {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Start Date *</label>
                  <input type="date" required value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Deadline *</label>
                  <input type="date" required value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Est. Hours</label>
                  <input type="number" min="0" value={formData.estimatedHours || ''}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Google Drive Link</label>
                  <input type="url" value={formData.driveLink}
                    onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" placeholder="https://drive.google.com/..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-600">{selectedTask.taskId}</span>
                <h2 className="text-xl font-bold">{selectedTask.title}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedTask.status)}`}>
                  {taskStatuses.find(s => s.id === selectedTask.status)?.name}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm ${getPriorityBadge(selectedTask.priority)}`}>
                  {selectedTask.priority} priority
                </span>
              </div>

              <p className="text-gray-600">{selectedTask.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Assigned To</p>
                  <p className="font-medium">{selectedTask.assignedName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <p className="font-medium">{selectedTask.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Job</p>
                  <p className="font-medium">{selectedTask.jobName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-medium">{new Date(selectedTask.startDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Deadline</p>
                  <p className="font-medium">{new Date(selectedTask.deadline).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Est. Hours</p>
                  <p className="font-medium">{selectedTask.estimatedHours} hrs</p>
                </div>
              </div>

              {/* Google Drive Link */}
              {selectedTask.driveLink && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Google Drive</p>
                  <a href={selectedTask.driveLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline">
                    <ExternalLink size={16} />
                    Open in Google Drive
                  </a>
                </div>
              )}

              {/* Attachments */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-gray-900">Attachments ({selectedTask.attachments.length})</p>
                  <button className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus size={14} />Add File
                  </button>
                </div>
                {selectedTask.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.attachments.map((file: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.type)}
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.size}</p>
                          </div>
                        </div>
                        <button className="text-blue-600 hover:underline text-sm">Download</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No attachments</p>
                )}
              </div>

              {/* Remarks */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-gray-900">Remarks & Notes ({selectedTask.remarks.length})</p>
                  <button onClick={() => setShowRemarkModal(true)} 
                    className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus size={14} />Add Remark
                  </button>
                </div>
                {selectedTask.remarks.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.remarks.map((remark: any, idx: number) => (
                      <div key={idx} className="bg-white rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{remark.by}</span>
                          <span className="text-xs text-gray-500">{remark.date}</span>
                        </div>
                        <p className="text-sm text-gray-600">{remark.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No remarks yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => setShowTransferModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-100 text-purple-700 rounded-xl font-medium hover:bg-purple-200">
                  <RefreshCw size={18} />Transfer Task
                </button>
                <button onClick={() => handleEdit(selectedTask)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">
                  <Edit size={18} />Edit Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Remark Modal */}
      {showRemarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Remark</h2>
              <button onClick={() => setShowRemarkModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <textarea value={newRemark} onChange={(e) => setNewRemark(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg" rows={3} placeholder="Enter remark or note..." />
              <div className="flex gap-3">
                <button onClick={() => setShowRemarkModal(false)} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button onClick={handleAddRemark} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                  Add Remark
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Task Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Transfer Task</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-gray-600">Transfer this task to another designer:</p>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg">
                <option value="">Select Designer</option>
                {designers.filter(d => d.id !== selectedTask?.assignedTo).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button onClick={handleTransferTask} disabled={!transferTo}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                  Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
