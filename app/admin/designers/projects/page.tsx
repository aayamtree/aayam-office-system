'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, CheckCircle,
  AlertCircle, Users, Briefcase, ChevronDown, ExternalLink, BarChart3
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

const projectStatuses = [
  { id: 'planning', name: 'Planning', color: 'bg-gray-100 text-gray-700' },
  { id: 'in_progress', name: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { id: 'review', name: 'Review', color: 'bg-purple-100 text-purple-700' },
  { id: 'on_hold', name: 'On Hold', color: 'bg-orange-100 text-orange-700' },
  { id: 'completed', name: 'Completed', color: 'bg-green-100 text-green-700' },
];

const initialProjects = [
  { id: 1, projectId: 'PRJ-001', name: 'Sharma Wedding Package', description: 'Complete wedding stationery design package',
    clientId: 1, clientName: 'Sharma Industries', teamMembers: [1, 2], teamNames: ['Rahul Sharma', 'Priya Patel'],
    startDate: '2025-12-15', endDate: '2026-01-10', status: 'in_progress', progress: 45,
    tasks: [
      { id: 1, name: 'Main Wedding Card', status: 'in_progress', progress: 60 },
      { id: 2, name: 'Envelope Design', status: 'pending', progress: 0 },
      { id: 3, name: 'RSVP Card', status: 'pending', progress: 0 },
      { id: 4, name: 'Thank You Card', status: 'pending', progress: 0 },
    ],
    driveLink: 'https://drive.google.com/folder/abc123', createdAt: '2025-12-15' },
  { id: 2, projectId: 'PRJ-002', name: 'Royal Prints Branding', description: 'Complete brand identity and marketing materials',
    clientId: 2, clientName: 'Royal Prints', teamMembers: [2, 3], teamNames: ['Priya Patel', 'Amit Kumar'],
    startDate: '2025-12-10', endDate: '2025-12-30', status: 'review', progress: 85,
    tasks: [
      { id: 1, name: 'Logo Design', status: 'completed', progress: 100 },
      { id: 2, name: 'Business Cards', status: 'completed', progress: 100 },
      { id: 3, name: 'Letterhead', status: 'completed', progress: 100 },
      { id: 4, name: 'Brochure Design', status: 'review', progress: 80 },
      { id: 5, name: 'Social Media Kit', status: 'in_progress', progress: 50 },
    ],
    driveLink: 'https://drive.google.com/folder/def456', createdAt: '2025-12-10' },
  { id: 3, projectId: 'PRJ-003', name: 'Gujarat Textiles Packaging', description: 'Product packaging design for textile products',
    clientId: 3, clientName: 'Gujarat Textiles', teamMembers: [3], teamNames: ['Amit Kumar'],
    startDate: '2025-12-20', endDate: '2026-01-15', status: 'planning', progress: 10,
    tasks: [
      { id: 1, name: 'Box Design Concept', status: 'in_progress', progress: 30 },
      { id: 2, name: 'Label Design', status: 'pending', progress: 0 },
      { id: 3, name: 'Hang Tag Design', status: 'pending', progress: 0 },
    ],
    driveLink: '', createdAt: '2025-12-20' },
];

export default function DesignerProjectsPage() {
  const [projects, setProjects] = useState(initialProjects);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showGanttModal, setShowGanttModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectCounter, setProjectCounter] = useState(4);

  const [formData, setFormData] = useState({
    name: '', description: '', clientId: '', teamMembers: [] as number[],
    startDate: '', endDate: '', driveLink: ''
  });

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.projectId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id.toString() === formData.clientId);
    const teamNames = formData.teamMembers.map(id => designers.find(d => d.id === id)?.name || '');
    
    if (editingProject) {
      setProjects(projects.map(p => p.id === editingProject.id ? 
        { ...p, ...formData, clientId: parseInt(formData.clientId), clientName: client?.name || '', teamNames } : p));
    } else {
      const newProject = {
        id: Date.now(), projectId: `PRJ-${String(projectCounter).padStart(3, '0')}`,
        ...formData, clientId: parseInt(formData.clientId), clientName: client?.name || '', teamNames,
        status: 'planning', progress: 0, tasks: [], createdAt: new Date().toISOString().split('T')[0]
      };
      setProjects([newProject, ...projects]);
      setProjectCounter(projectCounter + 1);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', clientId: '', teamMembers: [], startDate: '', endDate: '', driveLink: '' });
    setEditingProject(null);
    setShowModal(false);
  };

  const handleEdit = (project: any) => {
    setFormData({ name: project.name, description: project.description, clientId: project.clientId.toString(),
      teamMembers: project.teamMembers, startDate: project.startDate, endDate: project.endDate,
      driveLink: project.driveLink || '' });
    setEditingProject(project);
    setShowModal(true);
  };

  const handleTeamMemberToggle = (id: number) => {
    if (formData.teamMembers.includes(id)) {
      setFormData({ ...formData, teamMembers: formData.teamMembers.filter(m => m !== id) });
    } else {
      setFormData({ ...formData, teamMembers: [...formData.teamMembers, id] });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this project?')) setProjects(projects.filter(p => p.id !== id));
  };

  const getStatusBadge = (status: string) => projectStatuses.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-700';

  const getDaysRemaining = (endDate: string) => {
    const diff = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Stats
  const totalProjects = projects.length;
  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const onHold = projects.filter(p => p.status === 'on_hold').length;

  // Gantt Chart Data
  const getGanttData = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const totalDays = Math.ceil((endOfMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
    
    return projects.map(project => {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      const startOffset = Math.max(0, Math.ceil((start.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)));
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const width = (duration / totalDays) * 100;
      const left = (startOffset / totalDays) * 100;
      
      return { ...project, left: Math.min(left, 100), width: Math.min(width, 100 - left) };
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/designers" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Design Projects</h1>
            <p className="text-gray-500">Project timeline & management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGanttModal(true)}
            className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2.5 rounded-lg hover:bg-purple-200 font-medium">
            <BarChart3 size={18} />
            <span className="hidden sm:inline">Gantt View</span>
          </button>
          <Link href="/admin/designers/tasks"
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 font-medium">
            <Briefcase size={18} />
            <span className="hidden sm:inline">Tasks</span>
          </Link>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-medium">
            <Plus size={18} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Projects</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalProjects}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">In Progress</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{inProgress}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Completed</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{completed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">On Hold</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{onHold}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search projects..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Status</option>
            {projectStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-4">
        {filteredProjects.map(project => {
          const daysRemaining = getDaysRemaining(project.endDate);
          return (
            <div key={project.id} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow ${
              daysRemaining < 0 && project.status !== 'completed' ? 'border-l-4 border-l-red-500' : 
              daysRemaining <= 3 && project.status !== 'completed' ? 'border-l-4 border-l-orange-400' : ''}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-sm text-indigo-600 font-medium">{project.projectId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(project.status)}`}>
                      {projectStatuses.find(s => s.id === project.status)?.name}
                    </span>
                    {daysRemaining < 0 && project.status !== 'completed' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Overdue by {Math.abs(daysRemaining)} days
                      </span>
                    )}
                    {daysRemaining > 0 && daysRemaining <= 3 && project.status !== 'completed' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        {daysRemaining} days left
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  <p className="text-sm text-gray-500">{project.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2">
                    <span className="flex items-center gap-1"><Briefcase size={14} />{project.clientName}</span>
                    <span className="flex items-center gap-1"><Users size={14} />{project.teamNames.join(', ')}</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(project.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - 
                      {new Date(project.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Progress */}
                  <div className="w-32">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        project.progress >= 100 ? 'bg-green-500' : 
                        project.progress >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
                        style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSelectedProject(project); setShowDetailModal(true); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                    <button onClick={() => handleEdit(project)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(project.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>
              
              {/* Task Progress */}
              {project.tasks.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-2">Tasks ({project.tasks.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {project.tasks.map((task: any) => (
                      <span key={task.id} className={`text-xs px-2 py-1 rounded-lg ${
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'}`}>
                        {task.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-lg font-medium text-gray-900">No projects found</h3>
          <p className="mt-1 text-gray-500">Create projects to manage design work</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingProject ? 'Edit Project' : 'Create Project'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Project Name *</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" placeholder="Wedding Stationery Package" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" rows={2} placeholder="Project details..." />
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
                <label className="block text-sm font-medium mb-1.5">Team Members *</label>
                <div className="flex flex-wrap gap-2">
                  {designers.map(d => (
                    <button key={d.id} type="button" onClick={() => handleTeamMemberToggle(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.teamMembers.includes(d.id) 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Start Date *</label>
                  <input type="date" required value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">End Date *</label>
                  <input type="date" required value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Google Drive Link</label>
                <input type="url" value={formData.driveLink}
                  onChange={(e) => setFormData({ ...formData, driveLink: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg" placeholder="https://drive.google.com/..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={formData.teamMembers.length === 0}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {editingProject ? 'Update' : 'Create'} Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="font-mono text-indigo-600">{selectedProject.projectId}</span>
                <h2 className="text-xl font-bold">{selectedProject.name}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedProject.status)}`}>
                  {projectStatuses.find(s => s.id === selectedProject.status)?.name}
                </span>
              </div>

              <p className="text-gray-600">{selectedProject.description}</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Client</p>
                  <p className="font-medium">{selectedProject.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Team</p>
                  <p className="font-medium">{selectedProject.teamNames.join(', ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-medium">{new Date(selectedProject.startDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className="font-medium">{new Date(selectedProject.endDate).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Overall Progress</span>
                  <span className="text-lg font-bold text-indigo-600">{selectedProject.progress}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${selectedProject.progress}%` }} />
                </div>
              </div>

              {/* Tasks */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-medium text-gray-900 mb-3">Project Tasks ({selectedProject.tasks.length})</p>
                {selectedProject.tasks.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProject.tasks.map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          {task.status === 'completed' ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <Clock size={16} className="text-gray-400" />
                          )}
                          <span className="font-medium">{task.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          task.status === 'completed' ? 'bg-green-100 text-green-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-600'}`}>
                          {task.progress}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No tasks added yet</p>
                )}
              </div>

              {/* Google Drive */}
              {selectedProject.driveLink && (
                <a href={selectedProject.driveLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-100 text-blue-700 rounded-xl font-medium hover:bg-blue-200">
                  <ExternalLink size={18} />
                  Open in Google Drive
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gantt Chart Modal */}
      {showGanttModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-auto">
            <div className="p-5 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between z-10">
              <h2 className="text-xl font-bold">Gantt Chart View</h2>
              <button onClick={() => setShowGanttModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5">
              {/* Timeline Header */}
              <div className="mb-4 flex">
                <div className="w-48 flex-shrink-0 font-medium text-gray-700">Project</div>
                <div className="flex-1 relative h-8">
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: 8 }).map((_, i) => {
                      const date = new Date();
                      date.setDate(date.getDate() + (i * 7));
                      return (
                        <div key={i} className="flex-1 text-xs text-gray-500 border-l pl-1">
                          {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Project Bars */}
              <div className="space-y-3">
                {getGanttData().map(project => (
                  <div key={project.id} className="flex items-center">
                    <div className="w-48 flex-shrink-0 pr-4">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs text-gray-500 truncate">{project.clientName}</p>
                    </div>
                    <div className="flex-1 relative h-8 bg-gray-100 rounded">
                      <div 
                        className={`absolute h-full rounded ${
                          project.status === 'completed' ? 'bg-green-500' :
                          project.status === 'in_progress' ? 'bg-blue-500' :
                          project.status === 'on_hold' ? 'bg-orange-500' :
                          'bg-gray-400'}`}
                        style={{ left: `${project.left}%`, width: `${project.width}%` }}>
                        <div className="h-full bg-black/20 rounded" style={{ width: `${project.progress}%` }} />
                      </div>
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-white drop-shadow">
                        {project.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span>In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded" />
                  <span>On Hold</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-400 rounded" />
                  <span>Planning</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
