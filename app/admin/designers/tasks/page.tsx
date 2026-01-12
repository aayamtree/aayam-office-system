'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, ArrowRight, CheckCircle,
  AlertCircle, User, Briefcase, MessageSquare, Paperclip, ExternalLink,
  FileText, Image, Video, Music, File, ChevronRight, Save, Send, MoreHorizontal,
  ChevronLeft, Loader2, Folder, GanttChart
} from 'lucide-react';

// --- HELPERS ---
const getDesignerStatus = (stage: string) => {
  const map: Record<string, string> = {
    'new': 'pending',
    'designing': 'in_progress',
    'approval': 'review',
    'printing': 'completed',
    'completed': 'completed',
    'delivered': 'completed'
  };
  return map[stage] || 'pending';
};

const taskStatuses = [
  { id: 'pending', name: 'To Do', color: 'bg-gray-100 text-gray-700' },
  { id: 'in_progress', name: 'Designing', color: 'bg-blue-100 text-blue-700' },
  { id: 'review', name: 'Client Review', color: 'bg-purple-100 text-purple-700' },
  { id: 'rework', name: 'Correction', color: 'bg-orange-100 text-orange-700' },
  { id: 'completed', name: 'Done', color: 'bg-green-100 text-green-700' },
];

const priorities = [
  { id: 'normal', name: 'Normal', color: 'text-blue-600 bg-blue-50' },
  { id: 'high', name: 'High', color: 'text-orange-600 bg-orange-50' },
  { id: 'urgent', name: 'Urgent', color: 'text-red-600 bg-red-50' },
];

// Mock for Logs until real DB table exists
const initialLogs = [
  { id: 1, time: 'System', text: 'Welcome to your workspace.' },
];

export default function DesignerWorkspace() {
  const { profile } = useAuth();
  const { jobs, loading: jobsLoading, error: jobsError, updateJobStage, createJob, updateJob } = useJobs();
  const { clients } = useClients();
  const { designers } = useDesigners();

  // Local State
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logs, setLogs] = useState(initialLogs);
  const [newLog, setNewLog] = useState('');
  const [newFeedback, setNewFeedback] = useState('');

  // UI State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const [activeTab, setActiveTab] = useState<'my_tasks' | 'team_tasks' | 'timeline' | 'notes'>('my_tasks');
  const [searchQuery, setSearchQuery] = useState('');

  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Note Form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch Notes
  const fetchNotes = async () => {
    if (!profile?.id) return;
    try {
      setLoadingNotes(true);
      const { data, error } = await supabase
        .from('designer_notes')
        .select('*')
        .eq('user_id', profile.id)
        .order('note_date', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          console.warn('Notes table missing');
          return;
        }
        throw error;
      }
      setNotes(data || []);
    } catch (e) {
      console.error('Error fetching notes:', e);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'notes') {
      fetchNotes();
    }
  }, [activeTab, profile?.id]);

  const handleSaveNote = async () => {
    if (!profile?.id || !noteTitle) return alert('Title is required');
    try {
      const noteData = {
        user_id: profile.id,
        title: noteTitle,
        content: noteContent,
        note_date: noteDate
      };

      if (selectedNote) {
        const { error } = await supabase.from('designer_notes').update(noteData).eq('id', selectedNote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('designer_notes').insert([noteData]);
        if (error) throw error;
      }

      await fetchNotes();
      setSelectedNote(null);
      setNoteTitle('');
      setNoteContent('');
    } catch (e: any) {
      alert('Error saving note: ' + (e.message || 'Check database schema'));
    }
  };

  const handleCreateNote = () => {
    setSelectedNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteDate(new Date().toISOString().split('T')[0]);
  };

  const selectNoteForEdit = (note: any) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content || '');
    setNoteDate(note.note_date || new Date().toISOString().split('T')[0]);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await supabase.from('designer_notes').delete().eq('id', id);
    await fetchNotes();
    if (selectedNote?.id === id) setSelectedNote(null);
  };

  const [newTaskData, setNewTaskData] = useState({
    title: '',
    clientId: '',
    jobType: 'Design',
    deadline: '',
    description: '',
    priority: 'normal',
    driveLink: '',
    designerId: ''
  });

  // Safety: Prevent infinite loading
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 3000);
    return () => clearTimeout(t);
  }, []);



  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // === DATA SYNC ===
  // === DATA SYNC ===
  useEffect(() => {
    if (jobs) {
      const mappedTasks = (jobs || [])
        .filter(job => ['new', 'designing', 'approval', 'printing', 'finishing', 'completed', 'delivered'].includes(job.current_stage || ''))
        .map(job => {
          // Resolve Relationships (Manual Join)
          const client = (clients || []).find(c => c.id === job.client_id);
          const designer = (designers || []).find(d => d.id === job.designer_id);

          return {
            id: parseInt(job.id.substring(0, 8), 16) || Math.floor(Math.random() * 1000000),
            realId: job.id,
            taskId: job.job_number || 'JOB',
            title: job.project_name,
            clientName: client?.name || 'Unknown Client', // Name resolved!
            status: getDesignerStatus(job.current_stage),
            priority: job.priority || 'normal',
            // Formatting Date to 'DD MMM'
            deadline: job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
            rawDeadline: job.client_deadline,
            description: `Job Type: ${job.job_type || '-'}\nDetails: ${job.description || 'No description provided.'}`,
            feedback: [],
            driveLink: job.files?.[0] || '',
            orderId: job.id,
            designerId: job.designer_id,
            designerName: designer?.name || 'Unassigned',  // Name resolved!
            createdAt: job.created_at,
            current_stage: job.current_stage
          };
        })
        .sort((a, b) => {
          if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      setTasks(mappedTasks);
    }
  }, [jobs, clients, designers]);

  // --- LOGIC ---
  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.deadline && task.deadline.includes(searchQuery));

    // Team Logic
    const isAssignedToMe = task.designerId === profile?.id;
    // If showTeamTasks is true -> Show All
    // If showTeamTasks is false -> Show Mine + Unassigned (to pick up)
    // If showTeamTasks is false -> Show Mine + Unassigned (to pick up)
    const matchesView = activeTab === 'team_tasks' ? true : (isAssignedToMe || !task.designerId);

    // Filter out completed tasks from MAIN VIEW unless searching?
    // Maybe keep them but at bottom. For now, show active only in default views?
    // User wants "Work Summary", so keeping them in state is good.
    // Let's hide 'delivered' from active queue to reduce clutter?
    // User didn't specify, so I'll show all.

    return matchesSearch && matchesView;
  });

  const selectedTask = tasks.find(t => (t.id === selectedTaskId) || (t.realId === selectedTaskId)); // Handle ID mismatch

  // Work Summary Stats
  const thisMonthCount = tasks.filter(t => {
    const d = new Date(t.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const lastMonthCount = tasks.filter(t => {
    const d = new Date(t.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() - 1 && d.getFullYear() === now.getFullYear();
  }).length;


  // Calendar Helpers
  const daysInMonth = currentDate ? new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() : 0;
  const firstDay = currentDate ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() : 0; // 0 = Sun
  const monthName = currentDate ? currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }) : '';
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // 0 = Mon

  const prevMonth = () => currentDate && setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => currentDate && setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getTasksForDate = (day: number) => {
    if (!currentDate) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.deadline === dateStr);
  };

  // --- ACTIONS ---
  // Create Task (Now actually creates a JOB via hook if we unwired it, but for now mock action on local state is removed/replaced?)
  // User said "admin create new project", so Designer "Create Task" might be disabled OR it creates a 'Draft' job.
  // I will leave it as LOCAL for now, or alert "Only Admin can create projects".
  // But to be helpful, I'll log to console.
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTask(true);

    if (!newTaskData.title || !newTaskData.clientId) {
      alert('Please select a client and enter project name');
      setCreatingTask(false);
      return;
    }

    try {
      // Find selected client to get company name if needed, but ID is enough for DB
      const { error } = await createJob({
        project_name: newTaskData.title,
        client_id: newTaskData.clientId,
        job_type: newTaskData.jobType,
        priority: newTaskData.priority as any,
        description: newTaskData.description + (newTaskData.driveLink ? `\n\nDrive Link: ${newTaskData.driveLink}` : ''),
        client_deadline: newTaskData.deadline || null,
        current_stage: 'new',
        total_amount: 0,
        paid_amount: 0,
        payment_status: 'pending',
        designer_id: newTaskData.designerId || profile?.id, // Use selected or self
        files: newTaskData.driveLink ? [newTaskData.driveLink] : []
      } as any);

      if (error) throw new Error(error);

      alert('Project Created Successfully! Admin has been notified.');
      setIsNewTaskModalOpen(false);
      // Reset critical fields
      setNewTaskData(prev => ({ ...prev, title: '', description: '', deadline: '', driveLink: '' }));
    } catch (e: any) {
      alert('Error creating project: ' + e.message);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.trim()) return;
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setLogs([{ id: Date.now(), time, text: newLog }, ...logs]);
    setNewLog('');
  };

  const handleAddFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app, write to Supabase 'comments' table
    alert("Message sent! (Simulated)");
    setNewFeedback('');
  };

  const updateStatus = async (realId: string, newStatusId: string) => {
    // Map Designer UI status to Database Job Stage
    // To Do -> new
    // Designing -> designing
    // Review -> approval
    // Done -> printing (or completed)

    let dbStage = 'new';
    if (newStatusId === 'in_progress') dbStage = 'designing';
    if (newStatusId === 'review') dbStage = 'approval';
    if (newStatusId === 'completed') dbStage = 'printing'; // Move to print

    // Call Hook
    if (realId && updateJobStage) {
      await updateJobStage(realId, dbStage as any);
    }
  };

  return (
    <div className="flex flex-col md:flex-row bg-gray-50 md:h-[calc(100vh-4rem)] md:overflow-hidden h-auto overflow-y-auto">

      {/* =================================================================================
          COLUMN 1: TASK QUEUE (List)
         ================================================================================= */}
      <div className="w-full md:w-80 bg-white border-r flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">

        {/* Stats & Toggle Header */}
        <div className="p-4 pb-0 bg-gray-50/50 space-y-3">
          {/* Work Summary Widget */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-2 rounded-lg border border-indigo-100 shadow-sm">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">This Month</p>
              <p className="text-lg font-bold text-indigo-700">{thisMonthCount} <span className="text-[10px] text-gray-400 font-normal">Tasks</span></p>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Last Month</p>
              <p className="text-lg font-bold text-gray-600">{lastMonthCount} <span className="text-[10px] text-gray-400 font-normal">Tasks</span></p>
            </div>
          </div>

          {/* View Tabs - Color Blocks */}
          <div className="grid grid-cols-3 gap-2 mt-4 px-1">
            <button
              onClick={() => setActiveTab('my_tasks')}
              className={`py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-sm border ${activeTab === 'my_tasks'
                ? 'bg-white text-blue-600 border-blue-600 ring-2 ring-blue-100'
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 opacity-90 hover:opacity-100'
                }`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setActiveTab('team_tasks')}
              className={`py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-sm border ${activeTab === 'team_tasks'
                ? 'bg-white text-orange-600 border-orange-600 ring-2 ring-orange-100'
                : 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600 opacity-90 hover:opacity-100'
                }`}
            >
              Team Tasks
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-sm border ${activeTab === 'timeline'
                ? 'bg-white text-blue-600 border-blue-600 ring-2 ring-blue-100'
                : 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 opacity-90 hover:opacity-100'
                }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all shadow-sm border ${activeTab === 'notes'
                ? 'bg-white text-emerald-600 border-emerald-600 ring-2 ring-emerald-100'
                : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 opacity-90 hover:opacity-100'
                }`}
            >
              My Notes
            </button>
          </div>
        </div>

        <div className="p-4 border-b bg-gray-50/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Briefcase size={18} className="text-indigo-600" />
              {activeTab === 'notes' ? 'My Notes' : (activeTab === 'team_tasks' ? 'Team Queue' : 'My Queue')}
            </h2>
            <button
              onClick={() => setIsNewTaskModalOpen(true)}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1 text-xs font-bold px-3"
            >
              <Plus size={14} /> New Project
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search project, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {(!forceShow && jobsLoading) ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
          ) : jobsError ? (
            <div className="p-4 m-2 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex flex-col items-center gap-2">
              <AlertCircle size={20} />
              <p className="font-bold underline">Error Loading Tasks</p>
              <p>{String(jobsError)}</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <p>No tasks found.</p>
            </div>
          ) : activeTab === 'timeline' ? (
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-4">
                <GanttChart size={16} /> Project Timeline Status
              </h3>
              {filteredTasks.length === 0 && <p className="text-sm text-gray-400">No active projects to show.</p>}
              {filteredTasks.map(task => {
                const start = new Date(task.createdAt).getTime();
                const end = task.rawDeadline ? new Date(task.rawDeadline).getTime() : new Date().getTime() + 86400000;
                const now = new Date().getTime();
                const totalDuration = Math.max(end - start, 86400000); // at least 1 day
                const elapsed = Math.max(0, now - start);
                const progress = Math.min(100, (elapsed / totalDuration) * 100);

                const isOverdue = now > end && task.status !== 'completed' && task.status !== 'delivered';

                return (
                  <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {isOverdue ? <AlertCircle size={18} /> : <Briefcase size={18} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800">{task.title}</h4>
                          <p className="text-xs text-gray-500">{task.clientName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${taskStatuses.find(s => s.id === task.status)?.color}`}>
                          {taskStatuses.find(s => s.id === task.status)?.name}
                        </span>
                      </div>
                    </div>

                    <div className="relative pt-2">
                      <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                        <span>Start: {new Date(task.createdAt).toLocaleDateString()}</span>
                        <span>Due: {task.deadline || 'No Date'}</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isOverdue ? 'bg-red-500' : (task.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600')}`} style={{ width: `${task.status === 'completed' ? 100 : progress}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'notes' ? (
            <div className="space-y-4">
              {currentDate && (
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Calendar size={14} /> Calendar</h3>
                  <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <span key={d} className="text-[10px] text-gray-400 font-bold">{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1;
                      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const hasNote = (notes || []).some(n => n?.note_date === dateStr);
                      return (
                        <div key={d} className={`text-xs h-6 flex items-center justify-center rounded-full cursor-pointer hover:bg-indigo-50 ${hasNote ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600'}`}>
                          {d}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button onClick={handleCreateNote} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700"><Plus size={16} /> New Note</button>

              {(notes || []).length === 0 ? <p className="text-center text-gray-400 text-xs py-4">No notes created.</p> : (notes || []).map((note, i) => (
                <div key={note?.id || `note-${i}`} onClick={() => selectNoteForEdit(note)} className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all bg-white ${selectedNote?.id === note?.id ? 'border-indigo-500 ring-1 ring-indigo-200' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-1"><h4 className="font-bold text-sm text-gray-800 line-clamp-1">{note?.title || 'Untitled'}</h4><span className="text-[10px] text-gray-400">{note?.note_date || ''}</span></div>
                  <p className="text-xs text-gray-500 line-clamp-2">{note?.content || ''}</p>
                </div>
              ))}
            </div>
          ) : (filteredTasks || []).map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group relative overflow-hidden
                ${selectedTaskId === task.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
            >
              {selectedTaskId === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}

              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[10px] text-gray-500 font-medium tracking-wide">{task.taskId}</span>
                <div className="flex flex-col items-end gap-0.5">
                  {task.rawDeadline && new Date(task.rawDeadline) < new Date() && task.current_stage !== 'delivered' ? (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1 mb-1">
                      <Clock size={10} /> Overdue
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium">{task.deadline || 'No Deadline'}</span>
                  )}

                  {/* Show Designer Label in Team View */}
                  {activeTab === 'team_tasks' && (
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                      {task.designerName}
                    </span>
                  )}
                </div>
              </div>
              <h3 className={`font-semibold text-sm mb-3 leading-snug ${selectedTaskId === task.id ? 'text-indigo-900' : 'text-gray-800'}`}>
                {task.title}
              </h3>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2.5 py-1 rounded-md font-medium ${taskStatuses.find(s => s.id === task.status)?.color}`}>
                  {taskStatuses.find(s => s.id === task.status)?.name}
                </span>
                {task.priority !== 'normal' && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shadow-sm ${priorities.find(p => p.id === task.priority)?.color}`}>
                    {task.priority}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =================================================================================
          COLUMN 2: ACTIVE WORKSPACE (Detail)
         ================================================================================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white">
        {activeTab === 'notes' ? (
          <div className="flex flex-col h-full bg-white relative">
            <div className="px-8 py-5 border-b flex justify-between items-center bg-white sticky top-0 z-20">
              <input type="text" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note Title..." autoFocus className="text-xl font-bold text-gray-900 border-none focus:ring-0 placeholder:text-gray-300 w-full bg-transparent" />
              <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} className="text-sm border-gray-200 rounded-lg ml-4" />
            </div>
            <div className="flex-1 p-8 bg-gray-50/30">
              <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Type your note content here..." className="w-full h-full bg-transparent border-none focus:ring-0 resize-none text-gray-700 leading-relaxed font-sans placeholder:text-gray-300 p-0" />
            </div>
            <div className="p-4 border-t bg-white flex justify-between items-center">
              {selectedNote && <button onClick={() => handleDeleteNote(selectedNote.id)} className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2"><Trash2 size={16} /> Delete</button>}
              <div className="flex gap-2 ml-auto">
                <button onClick={handleSaveNote} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2"><Save size={18} /> Save Note</button>
              </div>
            </div>
          </div>
        ) : selectedTask ? (
          <>
            {/* Header */}
            {/* Header */}
            <div className="px-6 py-5 border-b flex flex-col md:flex-row md:justify-between md:items-start bg-white sticky top-0 z-20 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                  <span className="text-xl font-bold text-gray-900 leading-tight">{selectedTask.title}</span>
                  <span className={`w-fit text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border ${priorities.find(p => p.id === selectedTask.priority)?.color}`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5 min-w-fit">
                    <User size={14} /> <span className="truncate max-w-[150px]">{selectedTask.clientName}</span>
                  </div>
                  <span className="hidden md:inline text-gray-300">|</span>
                  <div className="flex items-center gap-1.5 min-w-fit">
                    <Clock size={14} /> Due: {selectedTask.deadline || 'N/A'}
                  </div>
                  {/* Order ID Link if exists */}
                  <span className="hidden md:inline text-gray-300">|</span>
                  <div className="flex items-center gap-1.5 text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    <FileText size={12} /> Ref: {selectedTask.taskId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex-1 md:flex-none flex items-center gap-2 bg-gray-50 p-1 rounded-lg border w-full md:w-auto">
                  <span className="text-xs font-bold text-gray-500 pl-2 uppercase whitespace-nowrap">Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateStatus(selectedTask.realId, e.target.value)}
                    className="flex-1 md:flex-none bg-transparent text-gray-700 text-sm rounded px-2 py-1 cursor-pointer focus:ring-0 border-none outline-none font-semibold hover:bg-white transition-colors"
                  >
                    {taskStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">

              {/* 1. Brief / Description */}
              <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" /> Design Brief & Instructions
                </h4>
                <div className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                  {selectedTask.description}
                </div>
              </section>

              {/* 2. Assets & Assignment */}
              <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                {/* Google Drive Link */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Folder size={16} className="text-blue-600" /> Project Assets (Google Drive)
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      defaultValue={selectedTask.driveLink}
                      placeholder="https://drive.google.com/..."
                      className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                      onBlur={(e) => {
                        if (e.target.value !== selectedTask.driveLink) {
                          updateJob(selectedTask.realId, { drive_link: e.target.value } as any);
                        }
                      }}
                    />
                    {selectedTask.driveLink && (
                      <a href={selectedTask.driveLink} target="_blank" className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors">
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">Assigned Designer</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm font-medium text-gray-700 bg-white"
                      value={selectedTask.designerId || ''}
                      onChange={(e) => updateJob(selectedTask.realId, { designer_id: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {designers?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">Deadline</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg px-3 py-2 text-sm font-medium text-gray-700 bg-white"
                      defaultValue={selectedTask.rawDeadline ? selectedTask.rawDeadline.split('T')[0] : ''}
                      onChange={(e) => updateJob(selectedTask.realId, { client_deadline: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* 3. Feedback Loop */}
              <section className="flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} className="text-orange-500" /> Feedback & Corrections
                  </h4>
                </div>

                <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-sm h-[400px]">
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                    {/* Placeholder for real chat */}
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <MessageSquare size={48} className="mb-4 text-gray-200 opacity-50" />
                      <p className="text-sm font-medium">No feedback yet.</p>
                      <p className="text-xs text-gray-400 mt-1">Chat history will appear here.</p>
                    </div>
                  </div>
                  <form onSubmit={handleAddFeedback} className="p-4 border-t bg-white flex gap-3 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newFeedback}
                        onChange={(e) => setNewFeedback(e.target.value)}
                        placeholder="Type your reply or feedback..."
                        className="w-full border-gray-200 rounded-xl pl-4 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                    <button type="submit" disabled={!newFeedback.trim()} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
              <Briefcase size={40} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Ready to work?</h3>
            <p className="text-sm text-gray-500 max-w-xs text-center leading-relaxed">Select a task from your queue on the left to view details and start designing.</p>
          </div>
        )}
      </div>

      {/* =================================================================================
          COLUMN 3: PRODUCTIVITY BAR
         ================================================================================= */}
      <div className="w-full md:w-80 bg-white border-l h-full flex flex-col z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">

        {/* Full Month Calendar Widget */}
        <div className="p-6 border-b bg-gradient-to-br from-white to-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                <Calendar size={16} />
              </div>
              <h2>{monthName}</h2>
            </div>
            <div className="flex bg-white rounded-lg shadow-sm border border-gray-200">
              <button onClick={prevMonth} className="p-1 hover:bg-gray-50 text-gray-500"><ChevronLeft size={16} /></button>
              <button onClick={nextMonth} className="p-1 hover:bg-gray-50 text-gray-500"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="grid grid-cols-7 mb-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
              <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Empty cells */}
              {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8"></div>
              ))}
              {/* Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const tasksOnDay = getTasksForDate(day);
                const isToday = currentDate && new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth();
                const hasTasks = tasksOnDay.length > 0;

                return (
                  <div key={day} className={`h-8 flex flex-col items-center justify-center relative rounded-lg text-xs font-medium cursor-pointer transition-colors hover:bg-gray-50
                    ${isToday ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-gray-700'}`}>
                    {day}
                    {hasTasks && (
                      <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-red-500'}`}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Deadline</div>
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div> Today</div>
          </div>
        </div>

        {/* Daily Log */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="p-6 pb-2">
            <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
              <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                <Clock size={16} />
              </div>
              <h2>Daily Log</h2>
            </div>
            <p className="text-xs text-gray-500 pl-9">Track your work execution.</p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 space-y-6 py-4">
            <div className="relative border-l-2 border-gray-100 ml-3.5 space-y-8 pb-4">
              {logs.map(log => (
                <div key={log.id} className="relative pl-6 group">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300 ring-4 ring-white group-hover:border-indigo-500 transition-colors z-10"></div>
                  <span className="text-[10px] font-mono text-gray-400 block mb-1 font-medium">{log.time}</span>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed bg-gray-50 p-2 rounded-lg border border-transparent group-hover:border-gray-100 group-hover:shadow-sm transition-all">{log.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Add Log Input */}
          <div className="p-4 border-t bg-gray-50">
            <form onSubmit={handleAddLog} className="flex gap-2">
              <input
                type="text"
                value={newLog}
                onChange={(e) => setNewLog(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                placeholder="Finished logo design..."
              />
              <button type="submit" disabled={!newLog.trim()} className="p-3 bg-gray-900 text-white rounded-xl hover:bg-black disabled:opacity-50 shadow-md transition-all hover:-translate-y-0.5">
                <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
      {/* New Project Modal */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm"><Briefcase size={22} /></div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Create New Project</h3>
                  <p className="text-xs text-gray-500 font-medium">Initialize a new design or print job</p>
                </div>
              </div>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-8 flex-1 bg-white">
              <form id="create-project-form" onSubmit={handleCreateTask} className="space-y-8">

                {/* 1. Core Identification */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">1</span>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Project Basics</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-2">Project Name <span className="text-red-500">*</span></label>
                      <input required type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        placeholder="e.g. Wedding Invitation - Sharma Family"
                        value={newTaskData.title}
                        onChange={e => setNewTaskData({ ...newTaskData, title: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2">Client <span className="text-red-500">*</span></label>
                      <select required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                        value={newTaskData.clientId}
                        onChange={e => setNewTaskData({ ...newTaskData, clientId: e.target.value })}
                      >
                        <option value="">Select Client</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                      </select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-2">Assign Designer</label>
                      <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                        value={newTaskData.designerId}
                        onChange={e => setNewTaskData({ ...newTaskData, designerId: e.target.value })}
                      >
                        <option value="">Assign to Me (Default)</option>
                        {designers?.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Parameters */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">2</span>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Parameters</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">Job Type</label>
                      <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        value={newTaskData.jobType}
                        onChange={e => setNewTaskData({ ...newTaskData, jobType: e.target.value })}
                      >
                        <option value="Design">Design</option>
                        <option value="Printing">Printing</option>
                        <option value="Design + Printing">Design + Print</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">Deadline</label>
                      <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 font-medium text-gray-600"
                        value={newTaskData.deadline}
                        onChange={e => setNewTaskData({ ...newTaskData, deadline: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">Priority</label>
                      <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        value={newTaskData.priority}
                        onChange={e => setNewTaskData({ ...newTaskData, priority: e.target.value })}
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Assets & Content */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">3</span>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assets & Brief</h4>
                  </div>

                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 space-y-3">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-2">
                      <Folder size={14} className="text-blue-600" />
                      Google Drive Assets Folder
                    </label>
                    <input type="url" className="w-full border border-blue-200 rounded-lg px-4 py-3 text-sm focus:ring-2 ring-blue-500/20 focus:border-blue-500 placeholder:text-blue-300 bg-white"
                      placeholder="https://drive.google.com/drive/folders/..."
                      value={newTaskData.driveLink}
                      onChange={e => setNewTaskData({ ...newTaskData, driveLink: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Description / Work Items</label>
                    <textarea rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
                      placeholder="Describe specific requirements, items to print, size, quantity..."
                      value={newTaskData.description}
                      onChange={e => setNewTaskData({ ...newTaskData, description: e.target.value })}
                    />
                  </div>
                </div>

              </form>
            </div>

            <div className="p-5 border-t bg-gray-50 flex gap-4 items-center justify-end">
              <button type="button" onClick={() => setIsNewTaskModalOpen(false)} className="px-6 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-white hover:text-gray-800 transition-all text-sm">Cancel</button>
              <button form="create-project-form" type="submit" disabled={creatingTask} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 text-sm flex items-center gap-2">
                {creatingTask ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><CheckCircle size={16} /> Create Project</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper for download icon
function DownloadButton() {
  return (
    <button className="text-gray-400 hover:text-indigo-600 transition-colors">
      <div className="p-2 hover:bg-indigo-50 rounded-lg transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
      </div>
    </button>
  );
}
