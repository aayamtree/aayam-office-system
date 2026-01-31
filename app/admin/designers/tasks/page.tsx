'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import {
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, ArrowRight, CheckCircle,
  AlertCircle, User, Briefcase, MessageSquare, Paperclip, ExternalLink,
  FileText, Image, Video, Music, File, ChevronRight, Save, Send, MoreHorizontal,
  ChevronLeft, Loader2, Folder, GanttChart, Layout, Monitor, AlertTriangle, Palette, Printer
} from 'lucide-react';

// --- HELPERS ---
const getDesignerStatus = (stage: string) => {
  const map: Record<string, string> = {
    'new': 'pending',
    'designing': 'in_progress',
    'quality_check': 'review', // Internal Review
    'approval': 'waiting',     // Waiting for Client
    'printing': 'completed',   // Ready for Print
    'completed': 'completed',
    'delivered': 'completed'
  };
  return map[stage] || 'pending';
};

const taskStatuses = [
  { id: 'pending', name: 'To Do', color: 'bg-gray-100 text-gray-700' },
  { id: 'in_progress', name: 'Designing', color: 'bg-blue-100 text-blue-700' },
  { id: 'review', name: 'Review', color: 'bg-oms-blue text-oms-blue' },
  { id: 'waiting', name: 'Waiting Client', color: 'bg-amber-100 text-amber-700' },
  { id: 'completed', name: 'Done', color: 'bg-gray-100 text-gray-900' },
];

const priorities = [
  { id: 'normal', name: 'Normal', color: 'text-blue-600 bg-blue-50' },
  { id: 'high', name: 'High', color: 'text-orange-600 bg-orange-50' },
  { id: 'urgent', name: 'Urgent', color: 'text-red-600 bg-red-50' },
];

// NEW: Daily Briefing Modal
function DailyBriefingModal({ tasks, onClose, userName }: { tasks: any[], onClose: () => void, userName: string }) {
  const today = new Date().toISOString().split('T')[0];
  const dueToday = tasks.filter(t => t.deadline && (t.deadline === today || (t.rawDeadline && t.rawDeadline.startsWith(today))) && t.status !== 'completed' && t.status !== 'delivered');
  const overdue = tasks.filter(t => t.rawDeadline && t.rawDeadline < today && t.status !== 'completed' && t.status !== 'delivered');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl  w-full max-w-lg overflow-hidden border border-gray-100">
        <div className="bg-oms-blue p-6 text-white">
          <h2 className="text-page-title flex items-center gap-2">
            <Monitor size={24} /> Good Morning, {userName || 'Designer'}!
          </h2>
          <p className="text-white/80 text-sm mt-1">Here is your focus for today.</p>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-red-600 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={16} /> Overdue Tasks ({overdue.length})
              </h3>
              {overdue.map(t => (
                <div key={t.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                  <span className="text-sm font-medium text-red-900">{t.title}</span>
                  <span className="text-[10px] text-red-600 font-bold px-2 py-0.5 bg-white rounded-full">Due: {t.deadline}</span>
                </div>
              ))}
            </div>
          )}

          {dueToday.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-oms-blue font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} /> Due Today ({dueToday.length})
              </h3>
              {dueToday.map(t => (
                <div key={t.id} className="p-3 bg-[rgba(0,0,255,0.05)] border border-[rgba(0,0,255,0.1)] rounded-lg flex justify-between items-center">
                  <span className="text-sm font-medium text-indigo-900">{t.title}</span>
                  <span className="text-[10px] text-oms-blue font-bold px-2 py-0.5 bg-white rounded-full">Today</span>
                </div>
              ))}
            </div>
          )}

          {dueToday.length === 0 && overdue.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-2" />
              <p>You are all caught up! No urgent deadlines today.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-oms-blue text-white rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors"
          >
            Let&apos;s Start Working
          </button>
        </div>
      </div>
    </div>
  );
}

// Mock for Logs until real DB table exists
const initialLogs = [
  { id: 1, time: 'System', text: 'Welcome to your workspace.' },
];

export default function DesignerWorkspace() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { jobs, loading: jobsLoading, error: jobsError, updateJobStage, createJob, updateJob } = useJobs();
  const { clients } = useClients();

  // DEBUG: Check why clients dropdown is empty
  console.log('🔍 [Create Project Modal] Clients data:', {
    hasClients: !!clients,
    clientsLength: clients?.length || 0,
    firstClient: clients?.[0],
    profile: profile?.role
  });
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

  // Daily Briefing State
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);

  /* Update default to 'board' */
  const activeTab = (searchParams.get('view') || 'board');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Checklist State
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [checklistConfig, setChecklistConfig] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchChecklists = async () => {
      const { data } = await supabase.from('job_checklists').select('*');
      if (data) {
        const map: Record<string, string[]> = {};
        data.forEach((d: any) => {
          // Items might be JSON string or array depending on DB driver behavior
          map[d.job_type] = Array.isArray(d.items) ? d.items : JSON.parse(d.items || '[]');
        });
        setChecklistConfig(map);
      }
    };
    fetchChecklists();
  }, []);

  // Reset checklist when task selection changes
  useEffect(() => {
    setChecklist({});
  }, [selectedTaskId]);

  // Handle ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsNewTaskModalOpen(true);
    }
  }, [searchParams]);

  // Check LocalStorage for Daily Briefing
  useEffect(() => {
    // Only check if we have data loaded and valid profile
    if ((jobs || []).length > 0 && !jobsLoading && profile?.id) {
      const today = new Date().toISOString().split('T')[0];
      const lastSeen = localStorage.getItem('daily_briefing_seen_v2_' + profile.id); // Add version or specific key to avoid conflicts

      if (lastSeen !== today) {
        // Check if there's anything worth showing (due today or overdue)
        // We need to use "tasks" state which is derived from jobs
        // But tasks state might not be set instantly in same render cycle as jobs
        // Safest to rely on `tasks` from state, so add tasks to dependency
      }
    }
  }, [jobs, jobsLoading, profile?.id]);

  // Real check with tasks dependency
  useEffect(() => {
    if (tasks.length > 0 && profile?.id) {
      const today = new Date().toISOString().split('T')[0];
      const lastSeen = localStorage.getItem('daily_briefing_seen_v2_' + profile.id);

      if (lastSeen !== today) {
        const relevantTasks = tasks.map(t => {
          const isMyTask = !t.designerId || t.designerId === profile.id;
          if (!isMyTask) return null;
          const active = t.status !== 'completed' && t.status !== 'delivered';
          const rawDeadline = t.rawDeadline ? t.rawDeadline.split('T')[0] : null;
          const due = rawDeadline ? rawDeadline <= today : false;
          return (active && due) ? t : null;
        }).filter(Boolean);

        if (relevantTasks.length > 0) {
          setShowDailyBriefing(true);
        }
      }
    }
  }, [tasks, profile?.id]);

  const handleCloseBriefing = () => {
    const today = new Date().toISOString().split('T')[0];
    if (profile?.id) {
      localStorage.setItem('daily_briefing_seen_v2_' + profile.id, today);
    }
    setShowDailyBriefing(false);
  }

  // Update Priority
  const updatePriority = async (realId: string, priority: string) => {
    if (updateJob) {
      await updateJob(realId, { priority: priority as any });
    }
  };

  const setView = (view: string) => {
    router.push(`/admin/designers/tasks?view=${view}`);
  };

  // Kanban Columns - Fixed visibility with dark text on light backgrounds
  const kanbanColumns = [
    { id: 'pending', title: 'To Do', color: 'bg-gray-100', textColor: 'text-gray-900', border: 'border-gray-400' },
    { id: 'in_progress', title: 'Designing', color: 'bg-blue-50', textColor: 'text-gray-900', border: 'border-blue-500' },
    { id: 'review', title: 'Review', color: 'bg-[rgba(0,0,255,0.05)]', textColor: 'text-gray-900', border: 'border-oms-blue' },
    { id: 'waiting', title: 'Waiting', color: 'bg-white', textColor: 'text-gray-900', border: 'border-gray-500' },
    { id: 'completed', title: 'Done', color: 'bg-white', textColor: 'text-gray-900', border: 'border-green-500' }
  ];

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

  const [newTaskData, setNewTaskData] = useState<{
    title: string;
    clientId: string;
    jobType: string;
    deadline: string;
    description: string;
    priority: string;
    driveLink: string;
    designerId: string;
    file?: File | null;
  }>({
    title: '',
    clientId: '',
    jobType: 'Design',
    deadline: '',
    description: '',
    priority: 'normal',
    driveLink: '',
    designerId: '',
    file: null
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
            current_stage: job.current_stage,
            jobType: job.job_type || 'Design'
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

    // Team Logic with Admin Special Handling
    const isAssignedToMe = task.designerId === profile?.id;
    const isAdmin = profile?.role === 'admin';

    // Admin My Queue Logic: Show tasks needing admin attention + unassigned tasks
    const needsAdminAttention = isAdmin && (
      !task.designerId || // Unassigned tasks
      task.current_stage === 'approval' || // Waiting for client approval (admin might need to follow up)
      (task.rawDeadline && new Date(task.rawDeadline) < new Date() && task.status !== 'completed') // Overdue tasks
    );

    // View Matching Logic
    let matchesView = false;
    if (activeTab === 'team_tasks') {
      matchesView = true; // Team view shows all tasks
    } else if (activeTab === 'my_tasks') {
      if (isAdmin) {
        matchesView = needsAdminAttention; // Admin sees tasks needing attention + unassigned
      } else {
        matchesView = isAssignedToMe || !task.designerId; // Designers see their tasks + unassigned
      }
    } else {
      matchesView = true; // Other views (board, timeline, notes) show all
    }

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
  // File Upload Logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedTask) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `job-files/${selectedTask.realId}/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('files')
        .upload(filePath, file);

      if (error) throw error;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(filePath);

      // Update Job
      // We need to fetch existing files first to append, but for now we might just set it as "drive_link" or a new field?
      // The current schema uses `files` JSONB array.
      const newFile = {
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString()
      };

      // Update local state temporarily
      const updatedFiles = [...(selectedTask.files || []), newFile];

      if (updateJob) {
        // This assumes updateJob can handle the 'files' column update (jsonb)
        // We need to cast it properly
        await updateJob(selectedTask.realId, { files: updatedFiles } as any);
        alert('File uploaded successfully!');
      }

    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTask(true);

    if (!newTaskData.title || !newTaskData.clientId) {
      alert('Please select a client and enter project name');
      setCreatingTask(false);
      return;
    }

    try {
      let initialFiles = [];

      // 1. Add Drive Link if exists
      if (newTaskData.driveLink) {
        initialFiles.push({ name: 'Drive Link', url: newTaskData.driveLink, type: 'link', size: 0, uploaded_at: new Date().toISOString() });
      }

      // 2. Upload File if selected
      if (newTaskData.file) {
        const file = newTaskData.file;
        const fileExt = file.name.split('.').pop();
        // Use Timestamp + Random to ensure uniqueness in temp folder
        const filePath = `temp-uploads/${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('files').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(filePath);

        initialFiles.push({
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString()
        });
      }

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
        amount_received: 0,
        payment_status: 'pending',
        designer_id: newTaskData.designerId || profile?.id, // Use selected or self
        files: initialFiles
      } as any);

      if (error) throw new Error(error);

      alert('Project Created Successfully! Admin has been notified.');
      setIsNewTaskModalOpen(false);
      // Reset critical fields
      setNewTaskData(prev => ({ ...prev, title: '', description: '', deadline: '', driveLink: '', file: null }));
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
    <>
      {showDailyBriefing && <DailyBriefingModal tasks={tasks.filter(t => !t.designerId || t.designerId === profile?.id)} onClose={handleCloseBriefing} userName={profile?.full_name?.split(' ')[0] || ''} />}

      <div className="flex flex-col md:flex-row bg-gray-50 md:h-[calc(100vh-4rem)] md:overflow-hidden h-auto overflow-y-auto">

        {activeTab === 'board' ? (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-gray-50">
            <div className="flex bg-white p-4 rounded-xl mb-4 justify-between items-center sticky left-0 min-w-[768px]">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><Layout size={20} /> Kanban Team Board</h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setView('my_tasks')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">List</button>
                  <button onClick={() => setView('board')} className="px-3 py-1 text-xs font-bold bg-white text-oms-blue rounded">Board</button>
                  <button onClick={() => setView('timeline')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Timeline</button>
                  <button onClick={() => setView('notes')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Notes</button>
                </div>
              </div>
              <button onClick={() => setIsNewTaskModalOpen(true)} className="px-4 py-2 bg-oms-blue text-white rounded-lg text-sm font-bold flex gap-2 items-center"><Plus size={16} /> New Task</button>
            </div>

            <div className="flex h-[calc(100%-5rem)] gap-6 min-w-max pb-4">
              {kanbanColumns.map(col => {
                const colTasks = tasks.filter(t => {
                  const matchesStatus = t.status === col.id || (col.id === 'pending' && (!t.status || t.status === 'new')); // fallback
                  const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
                  return matchesStatus && matchesSearch;
                });

                return (
                  <div key={col.id} className="w-80 flex flex-col bg-gray-100/50 rounded-2xl border border-gray-200/50">
                    <div className={`p-4 font-bold text-sm uppercase tracking-wide flex justify-between items-center ${col.textColor}`}>
                      {col.title}
                      <span className="bg-oms-blue text-white px-2 py-0.5 rounded text-xs font-bold">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {colTasks.map(task => {
                        // Job Type Icon Logic
                        let TypeIcon = Palette;
                        let typeLabel = "Design";
                        const descLower = (task.description || '').toLowerCase();
                        if (descLower.includes('print')) { TypeIcon = Printer; typeLabel = "Print"; }
                        if (descLower.includes('box') || descLower.includes('package')) { TypeIcon = Folder; typeLabel = "Pkg"; }

                        // Urgency Border Logic
                        let borderClass = col.border ? col.border.replace('border-', 'border-l-4 border-') : 'border-l-4 border-gray-400';
                        if (task.rawDeadline && new Date(task.rawDeadline) < new Date()) borderClass = 'border-l-4 border-red-500'; // Overdue overrides status

                        return (
                          <div key={task.id}
                            onClick={() => { setView('my_tasks'); setSelectedTaskId(task.id); }}
                            className={`bg-white p-4 rounded-xl border border-gray-100  transition-shadow cursor-pointer group relative ${borderClass}`}
                          >
                            {/* Revision Badge (Mocked based on description or random) */}
                            <div className="absolute top-4 right-4 text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border">Rev {(task.id % 3) + 1}</div>

                            <div className="flex justify-between items-start mb-2 pr-12">
                              {/* Job Type Tag */}
                              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                <TypeIcon size={10} /> {typeLabel}
                              </span>
                            </div>

                            <h4 className="font-bold text-gray-800 mb-1 line-clamp-2 leading-tight">{task.title}</h4>
                            <p className="text-xs text-gray-500 mb-3 font-medium">{task.clientName}</p>

                            {/* Footer Info */}
                            <div className="flex justify-between items-center border-t pt-3 mt-1">
                              <div className="flex items-center gap-3">
                                {/* Designer Avatar */}
                                <span className="text-[10px] font-bold text-oms-blue bg-[rgba(0,0,255,0.05)] border border-[rgba(0,0,255,0.1)] px-2 py-0.5 rounded overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">
                                  {task.designerName || 'Unassigned'}
                                </span>

                                {/* Date / Risk */}
                                {task.rawDeadline && (
                                  <span className={`flex items-center gap-1 text-[10px] font-bold ${new Date(task.rawDeadline) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                    {new Date(task.rawDeadline) < new Date() && <AlertTriangle size={10} />}
                                    {task.deadline}
                                  </span>
                                )}
                              </div>

                              {/* Drive Link Indicator (if exists) */}
                              {task.driveLink && <div className="text-blue-500"><Folder size={12} /></div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : activeTab === 'timeline' ? (
          <div className="flex-1 overflow-hidden flex flex-col bg-white">
            {/* Timeline Header */}
            <div className="flex bg-white p-4 justify-between items-center border-b">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><GanttChart size={20} /> Production Timeline</h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setView('my_tasks')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">List</button>
                  <button onClick={() => setView('board')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Board</button>
                  <button className="px-3 py-1 text-xs font-bold bg-white text-oms-blue rounded">Timeline</button>
                  <button onClick={() => setView('notes')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Notes</button>
                </div>
              </div>
              <button onClick={() => setIsNewTaskModalOpen(true)} className="px-4 py-2 bg-oms-blue text-white rounded-lg text-sm font-bold flex gap-2 items-center"><Plus size={16} /> New Task</button>
            </div>

            {/* Gantt Chart Body */}
            {/* Gantt Chart Body */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-2 md:p-6 bg-gray-50">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden min-w-[800px]">
                {/* Header Row */}
                <div className="grid grid-cols-12 bg-gray-50 border-b text-[10px] font-bold text-gray-500 uppercase tracking-wider h-10 items-center px-4">
                  <div className="col-span-3">Task / Designer</div>
                  <div className="col-span-1 border-l pl-2">Start</div>
                  <div className="col-span-8 flex justify-between px-2">
                    <span>Progression</span>
                    <span>Deadline</span>
                  </div>
                </div>

                {/* Rows */}
                {tasks.length === 0 ? <p className="p-8 text-center text-gray-400">No active tasks to show.</p> : tasks.map(task => {
                  // Calculate simplified progress bar width
                  const isOverdue = task.rawDeadline && new Date(task.rawDeadline) < new Date();

                  return (
                    <div key={task.id} className="grid grid-cols-12 border-b h-16 items-center px-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setSelectedTaskId(task.id); setView('my_tasks'); }}>
                      <div className="col-span-3 pr-4">
                        <div className="font-bold text-sm text-gray-800 truncate">{task.title}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1"><User size={10} /> {task.designerName}</div>
                      </div>
                      <div className="col-span-1 text-xs text-gray-500 pl-2 border-l">
                        {new Date(task.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="col-span-8 px-2 relative h-full flex items-center">
                        {/* Track */}
                        <div className="w-full h-2 bg-gray-100 rounded-full relative overflow-hidden">
                          {/* Bar */}
                          <div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : 'bg-[rgba(0,0,255,0.05)]0'}`} style={{ width: Math.random() * 60 + 20 + '%' }}></div>
                        </div>
                        {/* Deadline Tooltip */}
                        <div className="absolute right-0 text-xs font-bold text-gray-400">
                          {task.deadline || 'No Date'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* =================================================================================
          COLUMN 1: TASK QUEUE (List)
         ================================================================================= */}
            <div className="w-full md:w-80 bg-white border-r flex flex-col h-full z-10 [4px_0_24px_rgba(0,0,0,0.02)]">

              {/* Stats & Toggle Header */}
              <div className="p-4 pb-0 bg-gray-50/50 space-y-3">
                {/* Work Summary Widget */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded-lg border border-[rgba(0,0,255,0.1)]">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">This Month</p>
                    <p className="text-section text-oms-blue">{thisMonthCount} <span className="text-[10px] text-gray-400 font-normal">Tasks</span></p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Last Month</p>
                    <p className="text-section text-gray-600">{lastMonthCount} <span className="text-[10px] text-gray-400 font-normal">Tasks</span></p>
                  </div>
                </div>

                {/* View Tabs - Color Blocks */}
                <div className="grid grid-cols-4 gap-1 mt-4 px-1">
                  <button onClick={() => setView('my_tasks')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${activeTab === 'my_tasks' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>List</button>
                  <button onClick={() => setView('board')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${activeTab === 'board' ? 'bg-oms-blue text-white border-[rgba(0,0,255,0.2)]-600' : 'bg-white text-gray-500 border-gray-200'}`}>Board</button>
                  <button onClick={() => setView('timeline')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${activeTab === 'timeline' ? 'bg-oms-blue text-white border-[rgba(0,0,255,0.2)]-600' : 'bg-white text-gray-500 border-gray-200'}`}>Timeline</button>
                  <button onClick={() => setView('notes')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${activeTab === 'notes' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-200'}`}>Notes</button>
                </div>
              </div>

              {/* ... Rest of existing Column 1 content ... */}
              {/* We need to re-render the Search/List parts here exactly as they were, or just the top part of the layout. Since we replaced the top wrapper, we need to be careful with the closure. */}
              {/* Wait, the existing code follows immediately. I should just let the user see the diff. */}
              {/* I need to make sure I don't delete the rest of the file content unintentionally. */}
              {/* The tool view_file showed lines up to 100, then 150-250 etc. I need to be careful. */}
              {/* I will only replace the specific sections. */}

              <div className="p-4 border-b bg-gray-50/50">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                      <Briefcase size={18} className="text-oms-blue" />
                      {activeTab === 'notes' ? 'My Notes' : (activeTab === 'team_tasks' ? 'Team Queue' : 'My Queue')}
                    </h2>
                    {activeTab === 'my_tasks' && profile?.role === 'admin' && (
                      <p className="text-[10px] text-gray-500 mt-1 ml-7">Unassigned + Needs Attention + Overdue</p>
                    )}
                    {activeTab === 'my_tasks' && profile?.role === 'designer' && (
                      <p className="text-[10px] text-gray-500 mt-1 ml-7">Your assigned tasks</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsNewTaskModalOpen(true)}
                    className="p-2 bg-oms-blue text-white rounded-lg hover:bg-oms-blue transition-all flex items-center gap-1 text-xs font-bold px-3"
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
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-oms-blue bg-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {(!forceShow && jobsLoading) ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-oms-blue" /></div>
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
                        <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-100  transition-shadow">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-[rgba(0,0,255,0.05)] text-oms-blue'}`}>
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
                              <div className={`h-full rounded-full transition-all duration-1000 ${isOverdue ? 'bg-red-500' : (task.status === 'completed' ? 'bg-emerald-500' : 'bg-oms-blue')}`} style={{ width: `${task.status === 'completed' ? 100 : progress}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : activeTab === 'notes' ? (
                  <div className="space-y-4">
                    {currentDate && (
                      <div className="bg-white p-4 rounded-xl border border-gray-100">
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
                              <div key={d} className={`text-xs h-6 flex items-center justify-center rounded-full cursor-pointer hover:bg-[rgba(0,0,255,0.05)] ${hasNote ? 'bg-oms-blue text-oms-blue font-bold' : 'text-gray-600'}`}>
                                {d}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button onClick={handleCreateNote} className="w-full py-2 bg-oms-blue text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-oms-blue"><Plus size={16} /> New Note</button>

                    {(notes || []).length === 0 ? <p className="text-center text-gray-400 text-xs py-4">No notes created.</p> : (notes || []).map((note, i) => (
                      <div key={note?.id || `note-${i}`} onClick={() => selectNoteForEdit(note)} className={`p-3 rounded-xl border cursor-pointer  transition-all bg-white ${selectedNote?.id === note?.id ? 'border-oms-blue ring-1 ring-oms-blue' : 'border-gray-100'}`}>
                        <div className="flex justify-between items-start mb-1"><h4 className="font-bold text-sm text-gray-800 line-clamp-1">{note?.title || 'Untitled'}</h4><span className="text-[10px] text-gray-400">{note?.note_date || ''}</span></div>
                        <p className="text-xs text-gray-500 line-clamp-2">{note?.content || ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (filteredTasks || []).map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all  group relative overflow-hidden
                ${selectedTaskId === task.id ? 'bg-[rgba(0,0,255,0.05)] border-[rgba(0,0,255,0.2)] ring-1 ring-oms-blue' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                  >
                    {selectedTaskId === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[rgba(0,0,255,0.05)]0"></div>}

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
                          <span className="text-[9px] font-bold text-oms-blue bg-[rgba(0,0,255,0.05)] border border-[rgba(0,0,255,0.1)] px-1.5 py-0.5 rounded">
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
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorities.find(p => p.id === task.priority)?.color}`}>
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
                /* Note Editor */
                <div className="flex flex-col h-full bg-white relative">
                  <div className="px-8 py-5 border-b flex justify-between items-center bg-white sticky top-0 z-20">
                    <input type="text" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note Title..." autoFocus className="text-section text-gray-900 border-none focus:ring-0 placeholder:text-gray-300 w-full bg-transparent" />
                    <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} className="text-sm border-gray-200 rounded-lg ml-4" />
                  </div>
                  <div className="flex-1 p-8 bg-gray-50/30">
                    <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Type your note content here..." className="w-full h-full bg-transparent border-none focus:ring-0 resize-none text-gray-700 leading-relaxed font-sans placeholder:text-gray-300 p-0" />
                  </div>
                  <div className="p-4 border-t bg-white flex justify-between items-center">
                    {selectedNote && <button onClick={() => handleDeleteNote(selectedNote.id)} className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2"><Trash2 size={16} /> Delete</button>}
                    <div className="flex gap-2 ml-auto">
                      <button onClick={handleSaveNote} className="px-6 py-2 bg-oms-blue text-white rounded-xl font-bold hover:bg-oms-blue flex items-center gap-2"><Save size={18} /> Save Note</button>
                    </div>
                  </div>
                </div>
              ) : selectedTask ? (
                <>
                  {/* Header */}
                  <div className="px-6 py-5 border-b flex flex-col md:flex-row md:justify-between md:items-start bg-white sticky top-0 z-20 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                        <span className="text-section text-gray-900 leading-tight">{selectedTask.title}</span>
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
                        <div className="flex items-center gap-1.5 text-oms-blue font-medium bg-[rgba(0,0,255,0.05)] px-2 py-0.5 rounded-full whitespace-nowrap">
                          <FileText size={12} /> Ref: {selectedTask.taskId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {/* Priority Update */}
                      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border w-full md:w-auto">
                        <span className="text-xs font-bold text-gray-500 pl-2 uppercase whitespace-nowrap">Priority:</span>
                        <select
                          value={selectedTask.priority}
                          onChange={(e) => updatePriority(selectedTask.realId, e.target.value)}
                          className={`bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer outline-none uppercase ${priorities.find(p => p.id === selectedTask.priority)?.color?.replace('bg-', 'text-')}`}
                        >
                          {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>

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
                    <section className="bg-white p-6 rounded-2xl border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText size={16} className="text-oms-blue" /> Design Brief & Instructions
                      </h4>
                      <div className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                        {selectedTask.description}
                      </div>
                    </section>

                    {/* 2. Assets & Assignment */}
                    <section className="bg-white p-6 rounded-2xl border border-gray-100 space-y-6">
                      {/* Google Drive Link */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Folder size={16} className="text-blue-600" /> Project Assets (Drive / Local)
                        </h4>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="url"
                            defaultValue={selectedTask.driveLink}
                            placeholder="https://drive.google.com/..."
                            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                            onBlur={(e) => {
                              if (e.target.value !== selectedTask.driveLink && updateJob) {
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
                        {/* Local File Upload */}
                        <div className="flex items-center gap-2">
                          <input type="file" onChange={handleFileUpload} className="text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
                        </div>
                      </div>
                    </section>

                    {/* 3. Feedback & Corrections */}
                    <section className="flex-1 flex flex-col min-h-[300px]">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <MessageSquare size={16} className="text-orange-500" /> Feedback & Corrections
                        </h4>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden h-[320px]">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                          {/* Simulated Threaded Comments */}
                          {/* In a real app, map through 'remarks' joined to task */}
                          <div className="space-y-4">
                            <div className="flex gap-3">
                              <div className="min-w-8 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">M</div>
                              <div className="bg-white p-3 rounded-2xl rounded-tl-none border max-w-[80%]">
                                <div className="flex justify-between items-center mb-1 gap-4">
                                  <span className="text-[10px] font-bold text-gray-900">Manager</span>
                                  <span className="text-[9px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">Correction ❌</span>
                                </div>
                                <p className="text-xs text-gray-600">Client wants the logo bigger. Please check brand guidelines.</p>
                              </div>
                            </div>
                            <div className="flex gap-3 flex-row-reverse">
                              <div className="min-w-8 w-8 h-8 rounded-full bg-oms-blue flex items-center justify-center text-xs font-bold text-oms-blue">Me</div>
                              <div className="bg-oms-blue p-3 rounded-2xl rounded-tr-none border border-[rgba(0,0,255,0.2)]-600  max-w-[80%] text-white">
                                <div className="flex justify-between items-center mb-1 gap-4">
                                  <span className="text-[10px] font-bold text-white/80">You</span>
                                </div>
                                <p className="text-xs text-indigo-50">Updated. V2 attached in drive.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <form onSubmit={handleAddFeedback} className="p-4 border-t bg-white flex gap-3 items-center">
                          <input type="text" value={newFeedback} onChange={(e) => setNewFeedback(e.target.value)} placeholder="Type reply (tag: #correction, #approved)..." className="flex-1 border rounded-xl px-4 py-2 text-sm focus:ring-2 ring-oms-blue/20 outline-none" />
                          <button type="submit" disabled={!newFeedback.trim()} className="p-2 bg-oms-blue text-white rounded-xl hover:bg-oms-blue transition-colors"><Send size={18} /></button>
                        </form>
                      </div>
                    </section>

                    {/* 4. Final Review & Checklist */}
                    <section className="bg-gradient-to-br bg-white p-6 rounded-2xl border border-[rgba(0,0,255,0.1)] space-y-4">
                      <h4 className="text-xs font-bold text-oms-blue uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle size={16} /> Pre-Print Checklist (Mandatory)
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {(checklistConfig[selectedTask.jobType] || ['Bleed Checked', 'CMYK Confirmed', 'Spelling Verified', 'Size Confirmed']).map((label, i) => (
                          <label key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-[rgba(0,0,255,0.2)] transition-colors">
                            <input type="checkbox"
                              checked={!!checklist[`item_${i}`]}
                              onChange={e => setChecklist(prev => ({ ...prev, [`item_${i}`]: e.target.checked }))}
                              className="w-4 h-4 text-oms-blue rounded focus:ring-oms-blue border-gray-300"
                            />
                            <span className="text-sm font-bold text-gray-600">{label}</span>
                          </label>
                        ))}
                        <label className="col-span-2 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-[rgba(0,0,255,0.2)] transition-colors">
                          <input type="checkbox"
                            checked={checklist.approval || false}
                            onChange={e => setChecklist(prev => ({ ...prev, approval: e.target.checked }))}
                            className="w-4 h-4 text-oms-blue rounded focus:ring-oms-blue border-gray-300"
                          />
                          <span className="text-sm font-bold text-gray-600 flex items-center gap-2"><Paperclip size={14} /> Client Approval Attached / Verified</span>
                        </label>
                      </div>

                      <div className="pt-4 border-t border-[rgba(0,0,255,0.1)]">
                        {(() => {
                          const requiredList = checklistConfig[selectedTask.jobType] || ['Bleed Checked', 'CMYK Confirmed', 'Spelling Verified', 'Size Confirmed'];
                          const allMainChecks = requiredList.every((_, i) => checklist[`item_${i}`]);
                          const isComplete = allMainChecks && checklist.approval;

                          return (
                            <button
                              disabled={!isComplete}
                              onClick={() => {
                                if (confirm('Are you sure? This will lock the task for printing.')) {
                                  updateStatus(selectedTask.realId, 'completed');
                                }
                              }}
                              className="w-full py-4 rounded-xl font-bold text-white -200 flex items-center justify-center gap-2 transition-all
                             disabled:bg-gray-300 disabled: disabled:cursor-not-allowed bg-oms-blue hover:bg-oms-blue hover:scale-[1.01]"
                            >
                              {isComplete ? <><Printer size={20} /> Client Approved - Ready for Print</> : 'Complete Checklist to Finish'}
                            </button>
                          )
                        })()}
                        <p className="text-center text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wide">Prevents costly print mistakes</p>
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-gray-100">
                    <Briefcase size={40} className="text-gray-300" />
                  </div>
                  <h3 className="text-section text-gray-700 mb-2">Ready to work?</h3>
                  <p className="text-sm text-gray-500 max-w-xs text-center leading-relaxed">Select a task or switch to Board view.</p>
                </div>
              )}
            </div>

            {/* =================================================================================
          COLUMN 3: PRODUCTIVITY BAR
         ================================================================================= */}
            <div className="w-full md:w-80 bg-white border-l h-full flex flex-col z-10 [-4px_0_24px_rgba(0,0,0,0.02)]">

              {/* Full Month Calendar Widget */}
              <div className="p-6 border-b bg-gradient-to-br from-white to-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-gray-900 font-bold">
                    <div className="p-1.5 bg-oms-blue text-oms-blue rounded-lg">
                      <Calendar size={16} />
                    </div>
                    <h2>{monthName}</h2>
                  </div>
                  <div className="flex bg-white rounded-lg border border-gray-200">
                    <button onClick={prevMonth} className="p-1 hover:bg-gray-50 text-gray-500"><ChevronLeft size={16} /></button>
                    <button onClick={nextMonth} className="p-1 hover:bg-gray-50 text-gray-500"><ChevronRight size={16} /></button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100">
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
                        <div key={day} className={`h-8 flex flex-col items-center justify-center relative rounded-lg text-label cursor-pointer transition-colors hover:bg-gray-50
                    ${isToday ? 'bg-oms-blue text-white hover:bg-oms-blue' : 'text-gray-700'}`}>
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
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-oms-blue"></div> Today</div>
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
                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300 ring-4 ring-white group-hover:border-oms-blue transition-colors z-10"></div>
                        <span className="text-[10px] font-mono text-gray-400 block mb-1 font-medium">{log.time}</span>
                        <p className="text-xs text-gray-700 font-medium leading-relaxed bg-gray-50 p-2 rounded-lg border border-transparent group-hover:border-gray-100 group- transition-all">{log.text}</p>
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
                      className="flex-1 text-xs border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-oms-blue bg-white"
                      placeholder="Finished logo design..."
                    />
                    <button type="submit" disabled={!newLog.trim()} className="p-3 bg-oms-blue text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all hover:-translate-y-0.5">
                      <ArrowRight size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Project Modal */}
      {
        isNewTaskModalOpen && (
          <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl  overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
              {/* Premium Gradient Header */}
              <div className="relative p-6 bg-oms-blue overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
                <div className="relative flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl">
                      <Briefcase size={28} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-page-title mb-1">Create New Project</h3>
                      <p className="text-white/80 text-sm">Initialize a new design or print job with all details</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2.5 rounded-xl transition-all"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto p-8 flex-1 bg-gradient-to-b from-gray-50/50 to-white">
                <form id="create-project-form" onSubmit={handleCreateTask} className="space-y-8">

                  {/* 1. Project Basics */}
                  <div className="space-y-5 bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center gap-3 pb-3 border-b-2 border-oms-blue">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-oms-blue text-white text-sm font-bold -200">
                        1
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Project Basics</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          📝 Project Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all font-medium hover:border-gray-300"
                          placeholder="e.g. Wedding Invitation - Sharma Family"
                          value={newTaskData.title}
                          onChange={e => setNewTaskData({ ...newTaskData, title: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          👤 Client <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all bg-white hover:border-gray-300"
                          value={newTaskData.clientId}
                          onChange={e => setNewTaskData({ ...newTaskData, clientId: e.target.value })}
                        >
                          <option value="">Select Client</option>
                          {clients?.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          🎨 Assign Designer
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 ring-oms-blue/20 focus:border-oms-blue transition-all bg-white hover:border-gray-300"
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
                  <div className="space-y-5 bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center gap-3 pb-3 border-b-2 border-gradient-to-r from-orange-500 to-red-500">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm font-bold -200">
                        2
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Project Parameters</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          📋 Job Type
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-4 ring-orange-500/20 focus:border-orange-500 bg-white hover:border-gray-300 transition-all"
                          value={newTaskData.jobType}
                          onChange={e => setNewTaskData({ ...newTaskData, jobType: e.target.value })}
                        >
                          <option value="Design">🎨 Design Only</option>
                          <option value="Printing">🖨️ Printing Only</option>
                          <option value="Design + Printing">✨ Design + Print</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          📅 Deadline
                        </label>
                        <input
                          type="date"
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-4 ring-orange-500/20 focus:border-orange-500 font-medium text-gray-600 hover:border-gray-300 transition-all"
                          value={newTaskData.deadline}
                          onChange={e => setNewTaskData({ ...newTaskData, deadline: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          ⚡ Priority
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-4 ring-orange-500/20 focus:border-orange-500 bg-white hover:border-gray-300 transition-all"
                          value={newTaskData.priority}
                          onChange={e => setNewTaskData({ ...newTaskData, priority: e.target.value })}
                        >
                          <option value="normal">Normal</option>
                          <option value="high">⚠️ High</option>
                          <option value="urgent">🔥 Urgent</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 3. Assets & Brief */}
                  <div className="space-y-5 bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center gap-3 pb-3 border-b-2 border-gradient-to-r from-blue-500 to-cyan-500">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white text-sm font-bold -200">
                        3
                      </div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Assets & Brief</h4>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-xl border-2 border-blue-100 space-y-3">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Folder size={18} className="text-blue-600" />
                        Design Assets (Drive Link or File Upload)
                      </label>
                      <input
                        type="url"
                        className="w-full border-2 border-blue-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 ring-blue-500/20 focus:border-blue-500 placeholder:text-blue-300 bg-white hover:border-blue-300 transition-all"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={newTaskData.driveLink}
                        onChange={e => setNewTaskData({ ...newTaskData, driveLink: e.target.value })}
                      />
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400">OR</span>
                        <input
                          type="file"
                          onChange={e => {
                            if (e.target.files && e.target.files.length > 0) {
                              setNewTaskData({ ...newTaskData, file: e.target.files[0] });
                            }
                          }}
                          className="text-xs text-gray-600 file:mr-3 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-500 file:text-white hover:file:bg-blue-600 file: file:-200 file:transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        📄 Description / Work Items
                      </label>
                      <textarea
                        rows={4}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 ring-blue-500/20 focus:border-blue-500 leading-relaxed hover:border-gray-300 transition-all"
                        placeholder="Describe specific requirements, items to print, size, quantity, special instructions..."
                        value={newTaskData.description}
                        onChange={e => setNewTaskData({ ...newTaskData, description: e.target.value })}
                      />
                    </div>
                  </div>

                </form>
              </div>

              {/* Premium Footer with Action Buttons */}
              <div className="p-6 border-t-2 border-gray-100 bg-gradient-to-r from-gray-50 to-white flex gap-4 items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  form="create-project-form"
                  type="submit"
                  disabled={creatingTask}
                  className="px-8 py-3 bg-oms-blue text-white rounded-xl font-bold 2xl -300 disabled:opacity-50 transition-all transform hover:scale-105 text-sm flex items-center gap-2"
                >
                  {creatingTask ? <><Loader2 size={18} className="animate-spin" /> Creating...</> : <><CheckCircle size={18} /> Create Project</>}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}

// Helper for download icon
function DownloadButton() {
  return (
    <button className="text-gray-400 hover:text-oms-blue transition-colors">
      <div className="p-2 hover:bg-[rgba(0,0,255,0.05)] rounded-lg transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
      </div>
    </button>
  );
}
