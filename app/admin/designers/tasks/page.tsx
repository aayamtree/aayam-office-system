'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import DriveConnectionStatus from '@/components/drive/DriveConnectionStatus';
import { useJobs, useClients, useDesigners } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { logActivity, logFileUpload } from '@/lib/activity-logger';
import {
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, ArrowRight, CheckCircle, XCircle,
  AlertCircle, User, Briefcase, MessageSquare, Paperclip, ExternalLink,
  FileText, Image, Video, Music, File, ChevronRight, Save, Send, MoreHorizontal, Upload,
  Loader2, Folder, GanttChart, Layout, Monitor, AlertTriangle, Palette, Printer, Lock, Bell, BarChart3, TrendingUp, Zap
} from 'lucide-react';
import ProjectNotesLog from '@/components/ProjectNotesLog';
import { useConfirm } from '@/components/ConfirmModal';

// --- HELPERS ---
const getDesignerStatus = (stage: string) => {
  const map: Record<string, string> = {
    'new': 'pending',
    'awaiting_admin': 'pending',  // Designer can see but not change stage
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
  { id: 'in_progress', name: 'Designing', color: 'bg-muted text-foreground' },
  { id: 'review', name: 'Review', color: 'bg-gray-900 text-white' },
  { id: 'waiting', name: 'Waiting Client', color: 'bg-amber-100 text-amber-700' },
  { id: 'completed', name: 'Done', color: 'bg-gray-100 text-gray-900' },
  { id: 'on_hold', name: 'On Hold', color: 'bg-amber-50 text-amber-700' },
];

const priorities = [
  { id: 'normal', name: 'Normal', color: 'text-foreground bg-muted' },
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
      <div className="bg-white rounded-md  w-full max-w-lg overflow-hidden border border-gray-100">
        <div className="bg-gray-900 p-4 text-white">
          <h2 className="text-page-title flex items-center gap-2">
            <Monitor size={24} /> Good Morning, {userName || 'Designer'}!
          </h2>
          <p className="text-white/80 text-sm mt-1">Here is your focus for today.</p>
        </div>

        <div className="p-4 space-y-3 md:space-y-6 max-h-[60vh] overflow-y-auto">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-red-600 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={16} /> Overdue Tasks ({overdue.length})
              </h3>
              {overdue.map(t => (
                <div key={t.id} className="p-3 bg-red-50 border border-red-100 rounded-md flex justify-between items-center">
                  <span className="text-sm font-medium text-red-900">{t.title}</span>
                  <span className="text-xs text-red-600 font-bold px-2 py-0.5 bg-white rounded-md">Due: {t.deadline}</span>
                </div>
              ))}
            </div>
          )}

          {dueToday.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-primary font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} /> Due Today ({dueToday.length})
              </h3>
              {dueToday.map(t => (
                <div key={t.id} className="p-3 bg-muted border border-gray-200 rounded-md flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">{t.title}</span>
                  <span className="text-xs text-primary font-bold px-2 py-0.5 bg-white rounded-md">Today</span>
                </div>
              ))}
            </div>
          )}

          {dueToday.length === 0 && overdue.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle size={48} className="mx-auto text-foreground mb-2" />
              <p>You are all caught up! No urgent deadlines today.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-md font-bold text-sm hover:bg-gray-800 transition-colors"
          >
            Let&apos;s Start Working
          </button>
        </div>
      </div>
    </div>
  );
}

// Mock for Logs until real DB table exists


export default function DesignerWorkspace() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { jobs, loading: jobsLoading, error: jobsError, updateJobStage, createJob, updateJob, refetch: refetchJobs } = useJobs({
    filter: [{ column: 'current_stage', value: ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'quality_check', 'ready', 'delivered'], op: 'in' }],
    limit: 200
  });
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
  const [sidebarNotifications, setSidebarNotifications] = useState<any[]>([]);


  // UI State


  // Daily Briefing State
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);

  /* Admin defaults to team_tasks, designers to board */
  const isAdmin = profile?.role === 'admin';
  const confirmDialog = useConfirm();
  const activeTab = (searchParams.get('view') || (isAdmin ? 'team_tasks' : 'board'));
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
          const raw: any[] = Array.isArray(d.items) ? d.items : JSON.parse(d.items || '[]');
          // Items may be strings (legacy) or objects { label, type, required }
          map[d.job_type] = raw.map((i: any) => typeof i === 'string' ? i : (i.label || ''));
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

  // Handle ?action=new → redirect to dedicated page
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      router.push('/admin/designers/new-project');
    }
  }, [searchParams, router]);

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
    { id: 'in_progress', title: 'Designing', color: 'bg-muted', textColor: 'text-gray-900', border: 'border-primary' },
    { id: 'review', title: 'Review', color: 'bg-muted', textColor: 'text-gray-900', border: 'border-primary' },
    { id: 'waiting', title: 'Waiting', color: 'bg-white', textColor: 'text-gray-900', border: 'border-gray-500' },
    { id: 'completed', title: 'Done', color: 'bg-white', textColor: 'text-gray-900', border: 'border-green-500' },
    { id: 'on_hold', title: '⏸️ On Hold', color: 'bg-amber-50', textColor: 'text-amber-800', border: 'border-amber-400' }
  ];

  const getDisplayName = (member: any) => member.full_name || member.email?.split('@')[0] || 'User';
  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = { admin: 'Admin', designer: 'Designer', marketing: 'Marketing', dispatch: 'Dispatch', finance: 'Finance', cmyk: 'CMYK' };
    return map[role] || role;
  };




  // Safety: Prevent infinite loading
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 3000);
    return () => clearTimeout(t);
  }, []);



  // Fetch recent notifications for sidebar
  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase.from('broadcast_notifications').select('*').order('created_at', { ascending: false }).limit(5);
      if (data) setSidebarNotifications(data);
    };
    fetchNotifs();
  }, []);

  // === DATA SYNC ===
  // === DATA SYNC ===
  useEffect(() => {
    if (jobs) {
      const mappedTasks = (jobs || [])
        .filter(job => ['new', 'awaiting_admin', 'designing', 'approval', 'printing', 'finishing', 'completed', 'delivered'].includes(job.current_stage || ''))
        .map(job => {
          // Resolve Relationships (Manual Join)
          const client = (clients || []).find(c => c.id === job.client_id);
          const designer = (designers || []).find(d => d.id === job.designer_id);

          return {
            id: parseInt(job.id.substring(0, 8), 16) || Math.floor(Math.random() * 1000000),
            realId: job.id,
            taskId: job.job_number || 'JOB',
            title: job.project_name,
            clientName: client?.name || 'Unknown Client',
            priority: job.priority || 'normal',
            // Formatting Date to 'DD MMM'
            deadline: job.client_deadline ? new Date(job.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
            rawDeadline: job.client_deadline,
            description: `Job Type: ${job.job_type || '-'}\nDetails: ${job.description || 'No description provided.'}`,
            feedback: [],
            files: job.files || [],
            driveLink: (job.files && job.files.length > 0 && typeof job.files[0] === 'object') ? job.files[0]?.url : (job.files?.[0] || ''),
            orderId: job.id,
            designerId: job.designer_id,
            designerName: designer?.name || 'Unassigned',
            createdAt: job.created_at,
            current_stage: job.current_stage,
            jobType: job.job_type || 'Design',
            productCategory: job.product_category || '',
            approval_status: job.approval_status || 'pending',
            approval_by: job.approval_by,
            approval_date: job.approval_date,
            approval_remark: job.approval_remark,
            client_approval: job.client_approval,
            is_on_hold: job.is_on_hold || false,
            hold_reason: job.hold_reason || '',
            pre_hold_stage: job.pre_hold_stage || '',
            revision_count: job.revision_count || 0,
            status: job.is_on_hold ? 'on_hold' : getDesignerStatus(job.current_stage)
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
      (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.jobType && task.jobType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.productCategory && task.productCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.deadline && task.deadline.includes(searchQuery));

    // Team Logic with Admin Special Handling
    // Resolve the correct designer ID: try user_id first, then fall back to name match
    const myDesignerRecord = designers.find(d => d.user_id === profile?.id)
      || designers.find(d => d.name?.toLowerCase() === profile?.full_name?.toLowerCase());
    const isAssignedToMe = myDesignerRecord ? task.designerId === myDesignerRecord.id : false;

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
        matchesView = true; // Admin sees all tasks (Team Queue)
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


  // Sidebar Stats Helpers
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const completedThisWeek = tasks.filter(t => ['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(t.current_stage || '') && t.createdAt && new Date(t.createdAt) >= weekAgo).length;
  const totalRevisions = tasks.reduce((sum: number, t: any) => sum + (t.revision_count || 0), 0);
  const revisionRate = tasks.length > 0 ? Math.round((tasks.filter((t: any) => (t.revision_count || 0) > 0).length / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < now && !['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(t.current_stage || ''));
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const doneTasks = tasks.filter(t => ['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(t.current_stage || ''));

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
        await updateJob(selectedTask.realId, { files: updatedFiles } as any);
        // Log upload to activity feed
        logFileUpload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: publicUrl, uploadedTo: `Job ${selectedTask.taskId}`, resourceId: selectedTask.realId });

        // Notify assigned designer if someone else uploaded
        const myDesignerRec = designers.find((d: any) => d.user_id === profile?.id);
        const isMyJob = myDesignerRec ? selectedTask.designerId === myDesignerRec.id : false;
        if (!isMyJob && selectedTask.designerId && profile) {
          const uploaderName = profile.full_name || 'Someone';
          await supabase.from('broadcast_notifications').insert({
            message: `${uploaderName} uploaded "${file.name}" to your assigned job ${selectedTask.taskId} (${selectedTask.title})`,
            priority: 'normal',
            target_audience: 'designer',
            created_by: profile.id,
          });
        }

        refetchJobs();
        toast.success('File uploaded successfully!');
      }

    } catch (e: any) {
      toast.error(String('Upload failed: ' + e.message));
    }
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
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-gray-50">
            <div className="flex bg-white p-4 rounded-md mb-4 justify-between items-center sticky left-0 min-w-[768px]">
              <div className="flex items-center gap-2 md:gap-4">
                <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><Layout size={20} /> Kanban Team Board</h2>
                <div className="flex bg-gray-100 p-1 rounded-md">
                  <button onClick={() => setView('my_tasks')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">List</button>
                  <button onClick={() => setView('board')} className="px-3 py-1 text-xs font-bold bg-white text-primary rounded">Board</button>
                  <button onClick={() => setView('timeline')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Timeline</button>
                  <button onClick={() => router.push('/admin/designers/my-notes')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Notes</button>
                </div>
              </div>
              <button onClick={() => router.push('/admin/designers/new-project')} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-bold flex gap-2 items-center"><Plus size={16} /> New Task</button>
            </div>

            <div className="flex h-[calc(100%-5rem)] gap-3 md:gap-4 min-w-max pb-4">
              {kanbanColumns.map(col => {
                const colTasks = tasks.filter(t => {
                  const matchesStatus = t.status === col.id || (col.id === 'pending' && (!t.status || t.status === 'new')); // fallback
                  const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (t.productCategory && t.productCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    t.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
                  return matchesStatus && matchesSearch;
                });

                return (
                  <div key={col.id} className="w-80 flex flex-col bg-gray-100/50 rounded-md border border-gray-200/50">
                    <div className={`p-4 font-bold text-sm uppercase tracking-wide flex justify-between items-center ${col.textColor}`}>
                      {col.title}
                      <span className="bg-gray-900 text-white px-2 py-0.5 rounded text-xs font-bold">{colTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {colTasks.map(task => {
                        // Job Type Icon Logic
                        let TypeIcon = Palette;
                        let typeLabel = "Design";
                        const descLower = (task.description || '').toLowerCase();
                        if (descLower.includes('print')) { TypeIcon = Printer; typeLabel = "Print"; }
                        if (descLower.includes('box') || descLower.includes('package')) { TypeIcon = Folder; typeLabel = "Pkg"; }

                        // Header color: overdue = red, otherwise use col accent
                        const isOverdueCard = task.rawDeadline && new Date(task.rawDeadline) < new Date();
                        const cardHeaderBg = isOverdueCard ? 'bg-red-600' : col.id === 'completed' ? 'bg-gray-700' : col.id === 'in_progress' ? 'bg-gray-900' : col.id === 'review' ? 'bg-gray-800' : 'bg-gray-600';

                        return (
                          <div key={task.id}
                            onClick={() => { setView('my_tasks'); setSelectedTaskId(task.id); }}
                            className="bg-white rounded-md overflow-hidden border border-gray-200 transition-shadow cursor-pointer"
                          >
                            {/* Dark header */}
                            <div className={`${cardHeaderBg} px-3 py-1.5 flex items-center justify-between`}>
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-xs font-bold text-white/80 bg-white/15 px-1.5 py-0.5 rounded-md uppercase">
                                  <TypeIcon size={10} /> {typeLabel}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/20 text-white uppercase ${task.priority === 'urgent' ? '' : task.priority === 'high' ? '' : 'hidden'}`}>
                                  {task.priority}
                                </span>
                              </div>
                              {task.revision_count > 0 && (
                                <span className="text-[9px] font-mono text-white/80 bg-white/15 px-1.5 py-0.5 rounded-md">Rev {task.revision_count}</span>
                              )}
                            </div>

                            {/* Body */}
                            <div className="p-3">
                              {task.current_stage === 'awaiting_admin' && (
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-300">⏳ Awaiting Admin Approval</span>
                                </div>
                              )}
                              <h4 className="font-bold text-gray-800 mb-1 line-clamp-2 leading-tight text-sm">{task.title}</h4>
                              <p className="text-xs text-gray-500 mb-2 font-medium">{task.clientName}</p>

                              <div className="flex justify-between items-center border-t pt-2 mt-1">
                                <span className="flex items-center gap-1 text-xs font-bold text-primary bg-muted border border-gray-200 px-2 py-0.5 rounded-md overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                                  <User size={10} className="shrink-0" />
                                  {task.designerName || 'Unassigned'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {(task.files?.length > 0 || task.driveLink) && (
                                    <span className="flex items-center gap-0.5 text-gray-500" title={`${task.files?.length || 1} file(s)`}><Paperclip size={10} /><span className="text-xs font-bold">{task.files?.length || 1}</span></span>
                                  )}
                                  {task.rawDeadline && (
                                    <span className={`text-xs font-bold ${isOverdueCard ? 'text-red-500' : 'text-gray-400'}`}>
                                      {isOverdueCard && <AlertTriangle size={9} className="inline mr-0.5" />}
                                      {task.deadline}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {task.is_on_hold && (
                                <div className="-mx-3 -mb-3 mt-2 bg-amber-100 border-t border-amber-300 text-amber-800 text-xs font-bold text-center py-1.5 rounded-b-md uppercase tracking-wider">
                                  ⏸️ ON HOLD
                                </div>
                              )}
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
              <div className="flex items-center gap-2 md:gap-4">
                <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><GanttChart size={20} /> Production Timeline</h2>
                <div className="flex bg-gray-100 p-1 rounded-md">
                  <button onClick={() => setView('my_tasks')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">List</button>
                  <button onClick={() => setView('board')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Board</button>
                  <button className="px-3 py-2 text-xs font-bold bg-white text-primary rounded">Timeline</button>
                  <button onClick={() => router.push('/admin/designers/my-notes')} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-900">Notes</button>
                </div>
              </div>
              <button onClick={() => router.push('/admin/designers/new-project')} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-bold flex gap-2 items-center"><Plus size={16} /> New Task</button>
            </div>

            {/* Gantt Chart Body */}
            {/* Gantt Chart Body */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-2 md:p-4 bg-gray-50">
              <div className="bg-white rounded-md border border-gray-100 overflow-hidden min-w-[800px]">
                {/* Header Row */}
                <div className="grid grid-cols-12 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wider h-10 items-center px-4">
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
                          <div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : 'bg-muted0'}`} style={{ width: Math.random() * 60 + 20 + '%' }}></div>
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
            <div className="w-full md:w-96 bg-white border-r flex flex-col h-full z-10 [4px_0_24px_rgba(0,0,0,0.02)]">

              {/* Stats & Toggle Header */}
              <div className="p-4 pb-0 bg-gray-50/50 space-y-3">
                {/* Work Summary Widget */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded-md border border-gray-200">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">This Month</p>
                    <p className="text-section text-primary">{thisMonthCount} <span className="text-xs text-gray-400 font-normal">Tasks</span></p>
                  </div>
                  <div className="bg-white p-2 rounded-md border border-gray-100">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Last Month</p>
                    <p className="text-section text-gray-600">{lastMonthCount} <span className="text-xs text-gray-400 font-normal">Tasks</span></p>
                  </div>
                </div>

                {/* View Tabs - Color Blocks */}
                <div className="grid grid-cols-4 gap-1 mt-4 px-1">
                  <button onClick={() => setView(isAdmin ? 'team_tasks' : 'my_tasks')} className={`py-2 rounded-md text-xs font-bold border transition-all ${(activeTab === 'my_tasks' || activeTab === 'team_tasks') ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}>{isAdmin ? 'Team' : 'List'}</button>
                  <button onClick={() => setView('board')} className={`py-2 rounded-md text-xs font-bold border transition-all ${activeTab === 'board' ? 'bg-gray-900 text-white border-border-600' : 'bg-white text-gray-500 border-gray-200'}`}>Board</button>
                  <button onClick={() => setView('timeline')} className={`py-2 rounded-md text-xs font-bold border transition-all ${activeTab === 'timeline' ? 'bg-gray-900 text-white border-border-600' : 'bg-white text-gray-500 border-gray-200'}`}>Timeline</button>
                  <button onClick={() => router.push('/admin/designers/my-notes')} className={`py-2 rounded-md text-xs font-bold border transition-all bg-white text-gray-500 border-gray-200`}>Notes</button>
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
                      <Briefcase size={18} className="text-primary" />
                      {isAdmin || activeTab === 'team_tasks' ? 'Team Queue' : 'My Queue'}
                    </h2>
                    {isAdmin && (
                      <p className="text-xs text-gray-500 mt-1 ml-7">All designer tasks across team</p>
                    )}
                    {activeTab === 'my_tasks' && profile?.role === 'designer' && (
                      <p className="text-xs text-gray-500 mt-1 ml-7">Your assigned tasks</p>
                    )}
                  </div>
                  <button
                    onClick={() => router.push('/admin/designers/new-project')}
                    className="p-2 bg-gray-900 text-white rounded-md hover:bg-gray-900 transition-all flex items-center gap-1 text-xs font-bold px-3"
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
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 bg-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {(!forceShow && jobsLoading) ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
                ) : jobsError ? (
                  <div className="p-4 m-2 bg-red-50 text-red-600 text-xs rounded-md border border-red-100 flex flex-col items-center gap-2">
                    <AlertCircle size={20} />
                    <p className="font-bold underline">Error Loading Tasks</p>
                    <p>{String(jobsError)}</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    <p>No tasks found.</p>
                  </div>
                ) : activeTab === 'timeline' ? (
                  <div className="space-y-2 md:space-y-4 pt-2">
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
                        <div key={task.id} className="bg-white p-4 rounded-md border border-gray-100  transition-shadow">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-md ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-muted text-primary'}`}>
                                {isOverdue ? <AlertCircle size={18} /> : <Briefcase size={18} />}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-800">{task.title}</h4>
                                <p className="text-xs text-gray-500">{task.clientName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs font-bold px-2 py-1 rounded-md ${taskStatuses.find(s => s.id === task.status)?.color}`}>
                                {taskStatuses.find(s => s.id === task.status)?.name}
                              </span>
                            </div>
                          </div>

                          <div className="relative pt-2">
                            <div className="flex justify-between text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                              <span>Start: {new Date(task.createdAt).toLocaleDateString()}</span>
                              <span>Due: {task.deadline || 'No Date'}</span>
                            </div>
                            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${isOverdue ? 'bg-red-500' : (task.status === 'completed' ? 'bg-emerald-500' : 'bg-primary')}`} style={{ width: `${task.status === 'completed' ? 100 : progress}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (filteredTasks || []).map(task => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-4 rounded-md border cursor-pointer transition-all  group relative overflow-hidden
                ${selectedTaskId === task.id ? 'bg-muted border-border ring-1 ring-primary' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                  >
                    {selectedTaskId === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted0"></div>}

                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className="font-mono text-xs text-gray-500 font-medium tracking-wide">{task.taskId}</span>
                      {(() => {
                        const typeMap: Record<string, { label: string; bg: string; text: string }> = {
                          'Design': { label: 'DESIGN', bg: 'bg-violet-100', text: 'text-violet-700' },
                          'Printing': { label: 'PRINT', bg: 'bg-emerald-100', text: 'text-emerald-700' },
                          'Design + Printing': { label: 'DESIGN+PRINT', bg: 'bg-sky-100', text: 'text-sky-700' },
                          'Design + Print': { label: 'DESIGN+PRINT', bg: 'bg-sky-100', text: 'text-sky-700' },
                        };
                        const t = typeMap[task.jobType] || { label: task.jobType?.toUpperCase() || 'PROJECT', bg: 'bg-gray-100', text: 'text-gray-600' };
                        return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.bg} ${t.text}`}>{t.label}</span>;
                      })()}
                      {(() => {
                        const catMap: Record<string, { label: string; bg: string; text: string }> = {
                          'box': { label: '📦 BOX', bg: 'bg-amber-100', text: 'text-amber-700' },
                          'pouch': { label: '👝 POUCH', bg: 'bg-rose-100', text: 'text-rose-700' },
                          'label': { label: '🏷️ LABEL', bg: 'bg-indigo-100', text: 'text-indigo-700' },
                          'sticker': { label: '⭐ STICKER', bg: 'bg-pink-100', text: 'text-pink-700' },
                        };
                        const c = catMap[task.productCategory?.toLowerCase()];
                        return c ? <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{c.label}</span> : null;
                      })()}
                      {/* Deadline / Overdue inline */}
                      <span className="ml-auto flex-shrink-0">
                        {task.rawDeadline && new Date(task.rawDeadline) < new Date() && task.current_stage !== 'delivered' ? (
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Clock size={10} /> Overdue
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">{task.deadline || 'No Deadline'}</span>
                        )}
                      </span>
                    </div>
                    {/* Designer label for team view */}
                    {(activeTab === 'team_tasks' || isAdmin) && (
                      <div className="mb-1">
                        <span className="text-[9px] font-bold text-primary bg-muted border border-gray-200 px-1.5 py-0.5 rounded">
                          {task.designerName}
                        </span>
                      </div>
                    )}
                    <h3 className={`font-semibold text-sm mb-3 leading-snug ${selectedTaskId === task.id ? 'text-gray-900' : 'text-gray-800'}`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${taskStatuses.find(s => s.id === task.status)?.color}`}>
                        {taskStatuses.find(s => s.id === task.status)?.name}
                      </span>
                      {task.priority !== 'normal' && (
                        <span className={`text-xs px-2 py-0.5 rounded-md border ${priorities.find(p => p.id === task.priority)?.color}`}>
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
              {selectedTask ? (
                <>
                  {/* Header */}
                  <div className="px-6 py-5 border-b flex flex-col md:flex-row md:justify-between md:items-start bg-white sticky top-0 z-20 gap-2 md:gap-4">
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
                        <div className="flex items-center gap-1.5 text-primary font-medium bg-muted px-2 py-0.5 rounded-md whitespace-nowrap">
                          <FileText size={12} /> Ref: {selectedTask.taskId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {/* Priority Update */}
                      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border w-full md:w-auto">
                        <span className="text-xs font-bold text-gray-500 pl-2 uppercase whitespace-nowrap">Priority:</span>
                        <select
                          value={selectedTask.priority}
                          onChange={(e) => updatePriority(selectedTask.realId, e.target.value)}
                          className={`bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer outline-none uppercase ${priorities.find(p => p.id === selectedTask.priority)?.color?.replace('bg-', 'text-')}`}
                        >
                          {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>

                      <div className={`flex-1 md:flex-none flex items-center gap-2 p-1 rounded-md border w-full md:w-auto ${selectedTask.is_on_hold
                        ? 'bg-amber-500 border-amber-500'
                        : ['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(selectedTask.current_stage || '')
                          ? 'bg-gray-900 border-gray-900'
                          : 'bg-gray-50'
                        }`}>
                        {selectedTask.is_on_hold ? (
                          <span className="flex items-center gap-2 text-white text-xs font-bold px-3 py-1">
                            ⏸️ ON HOLD
                          </span>
                        ) : ['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(selectedTask.current_stage || '') ? (
                          <span className="flex items-center gap-2 text-white text-xs font-bold px-3 py-1">
                            <Lock size={12} /> Locked — Sent to Print
                          </span>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-gray-500 pl-2 uppercase whitespace-nowrap">Status:</span>
                            <select
                              value={selectedTask.status}
                              onChange={(e) => updateStatus(selectedTask.realId, e.target.value)}
                              className="flex-1 md:flex-none bg-transparent text-gray-700 text-sm rounded px-2 py-1 cursor-pointer focus:ring-0 border-none outline-none font-semibold hover:bg-white transition-colors"
                            >
                              {taskStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </>
                        )}
                      </div>

                      {/* Hold / Unhold Button (Admin Only) */}
                      {isAdmin && (
                        selectedTask.is_on_hold ? (
                          <button
                            onClick={async () => {
                              const { confirmed } = await confirmDialog({ title: 'Resume Project', message: 'This will resume the project and move it back to its previous stage.', variant: 'success', confirmLabel: 'Resume' });
                              if (!confirmed) return;
                              await supabase.from('jobs').update({
                                is_on_hold: false,
                                // If it was in a print/locked stage before hold, return to designing
                                // so the designer can open and work on it again
                                current_stage: ['printing', 'finishing', 'quality_check', 'ready', 'delivered', 'sent_to_print', 'approval'].includes(selectedTask.pre_hold_stage || '')
                                  ? 'designing'
                                  : selectedTask.pre_hold_stage || 'designing',
                                hold_reason: null,
                                pre_hold_stage: null,
                              }).eq('id', selectedTask.realId);
                              const userName = profile?.full_name || 'Admin';
                              await supabase.from('job_notes').insert([{
                                job_id: selectedTask.realId,
                                user_id: profile?.id,
                                content: `▶️ Project resumed by ${userName}. Back to ${selectedTask.pre_hold_stage || 'designing'}.`,
                                tag: 'update',
                                source: 'self',
                              }]);
                              await supabase.from('job_stage_history').insert([{
                                job_id: selectedTask.realId,
                                from_stage: 'on_hold',
                                to_stage: selectedTask.pre_hold_stage || 'designing',
                                notes: `▶️ Resumed by ${userName}`,
                              }]);
                              await logActivity({ action: 'update', resourceType: 'job', resourceId: selectedTask.realId, details: { description: `▶️ ${selectedTask.taskId} resumed by ${userName}. Back to ${selectedTask.pre_hold_stage || 'designing'}.`, holdAction: 'resume' } });
                              refetchJobs();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-bold hover:bg-green-700 transition-colors"
                          >
                            ▶️ Resume
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const { confirmed, inputValue } = await confirmDialog({ title: 'Put on Hold', message: 'This will freeze the project. The designer won\'t be able to work on it until you resume.', variant: 'warning', confirmLabel: 'Put on Hold', showInput: true, inputPlaceholder: 'Why are you putting this on hold?', inputRequired: true });
                              if (!confirmed || !inputValue) return;
                              const reason = inputValue;
                              await supabase.from('jobs').update({
                                is_on_hold: true,
                                hold_reason: reason,
                                pre_hold_stage: selectedTask.current_stage || 'designing',
                              }).eq('id', selectedTask.realId);
                              const userName = profile?.full_name || 'Admin';
                              await supabase.from('job_notes').insert([{
                                job_id: selectedTask.realId,
                                user_id: profile?.id,
                                content: `⏸️ Project put on hold by ${userName}. Reason: "${reason}"`,
                                tag: 'update',
                                source: 'self',
                              }]);
                              await supabase.from('job_stage_history').insert([{
                                job_id: selectedTask.realId,
                                from_stage: selectedTask.current_stage || 'designing',
                                to_stage: 'on_hold',
                                notes: `⏸️ On Hold: ${reason}`,
                              }]);
                              await logActivity({ action: 'update', resourceType: 'job', resourceId: selectedTask.realId, details: { description: `⏸️ ${selectedTask.taskId} put on hold by ${userName}. Reason: "${reason}"`, holdAction: 'hold' } });
                              refetchJobs();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-md text-xs font-bold hover:bg-amber-200 border border-amber-300 transition-colors"
                          >
                            ⏸️ Hold
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">

                    {/* Cross-Designer Warning Banner */}
                    {(() => {
                      const myDesignerRec = designers.find((d: any) => d.user_id === profile?.id);
                      const isMyJob = myDesignerRec ? selectedTask.designerId === myDesignerRec.id : false;
                      const assignedName = selectedTask.designerName || 'Unassigned';

                      if (!isAdmin && !isMyJob && selectedTask.designerId) {
                        return (
                          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-3">
                            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-amber-800">This job is assigned to {assignedName}</p>
                              <p className="text-xs text-amber-600 mt-0.5">Any changes you make will be logged and {assignedName} will be notified.</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* 1. Brief / Description */}
                    <section className="bg-white p-4 rounded-md border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FileText size={16} className="text-primary" /> Design Brief & Instructions
                      </h4>
                      <div className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                        {selectedTask.description}
                      </div>
                    </section>

                    {/* 2. Assets & Assignment */}
                    <section className="bg-white p-4 rounded-md border border-gray-100 space-y-6">
                      {/* Google Drive Link */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Folder size={16} className="text-foreground" /> Project Assets (Drive / Local)
                        </h4>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="url"
                            defaultValue={selectedTask.driveLink}
                            placeholder="https://drive.google.com/..."
                            className="flex-1 border rounded-md px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors"
                            onBlur={(e) => {
                              if (e.target.value !== selectedTask.driveLink && updateJob) {
                                updateJob(selectedTask.realId, { drive_link: e.target.value } as any);
                              }
                            }}
                          />
                          {selectedTask.driveLink && (
                            <a href={selectedTask.driveLink} target="_blank" className="p-2 bg-muted text-foreground rounded-md hover:bg-muted transition-colors">
                              <ExternalLink size={18} />
                            </a>
                          )}
                        </div>

                        {/* Attached Files List */}
                        {selectedTask.files && selectedTask.files.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {selectedTask.files.map((file: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md group hover:bg-gray-100 transition-colors">
                                <Paperclip size={12} className="text-gray-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-800 truncate">{file.name || `File ${i + 1}`}</p>
                                  {file.size && (
                                    <p className="text-xs text-gray-400">
                                      {file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {file.url && !file.url.startsWith('data:') && (
                                    <a href={file.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-gray-200 rounded" title="Open file">
                                      <ExternalLink size={12} className="text-gray-500" />
                                    </a>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={async () => {
                                        const updatedFiles = selectedTask.files.filter((_: any, idx: number) => idx !== i);
                                        if (updateJob) {
                                          await updateJob(selectedTask.realId, { files: updatedFiles } as any);
                                          refetchJobs();
                                        }
                                      }}
                                      className="p-1 hover:bg-red-100 rounded"
                                      title="Remove file"
                                    >
                                      <X size={12} className="text-red-500" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload New File */}
                        <label className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-md cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                          <Upload size={14} />
                          Upload File
                          <input type="file" onChange={handleFileUpload} className="hidden" />
                        </label>
                        {selectedTask.files?.length > 0 && (
                          <span className="ml-2 text-xs text-gray-400">{selectedTask.files.length} file(s) attached</span>
                        )}
                      </div>
                    </section>

                    {/* 3. Project Notes & Feedback Log (handles approval + revisions + lock) */}
                    {selectedTask?.realId && (() => {
                      const myDesigner = designers.find((d: any) => d.user_id === profile?.id);
                      const isAssignedDesigner = myDesigner ? selectedTask.designerId === myDesigner.id : false;
                      const canWriteNotes = isAdmin || isAssignedDesigner;
                      const effectiveStage = selectedTask.is_on_hold ? 'printing' : (selectedTask.current_stage || 'new');
                      return <ProjectNotesLog jobId={selectedTask.realId} canWrite={canWriteNotes} isAdmin={isAdmin} currentStage={effectiveStage} onStageChange={() => refetchJobs()} />;
                    })()}



                    {/* 5. Final Review & Checklist — hidden when locked or on hold */}
                    {!selectedTask.is_on_hold && !['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(selectedTask.current_stage || '') && (
                      <section className="bg-gradient-to-br bg-white p-4 rounded-md border border-gray-200 space-y-4">
                        <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle size={16} /> Pre-Print Checklist (Mandatory)
                        </h4>
                        {checklistConfig[selectedTask.productCategory] ? (
                          <p className="text-xs text-gray-400 -mt-2 mb-1">Template: <span className="font-bold">{selectedTask.productCategory}</span></p>
                        ) : (
                          <p className="text-xs text-amber-500 -mt-2 mb-1">⚠ No template for &ldquo;{selectedTask.productCategory || 'Unknown'}&rdquo;. Using default checks. <span className="font-semibold">Configure in Settings → Production.</span></p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {(checklistConfig[selectedTask.productCategory] || ['Bleed Checked', 'CMYK Confirmed', 'Spelling Verified', 'Size Confirmed']).map((label, i) => (
                            <label key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-md cursor-pointer hover:border-border transition-colors">
                              <input type="checkbox"
                                checked={!!checklist[`item_${i}`]}
                                onChange={e => setChecklist(prev => ({ ...prev, [`item_${i}`]: e.target.checked }))}
                                className="w-4 h-4 text-primary rounded focus:ring-gray-400 border-gray-300"
                              />
                              <span className="text-sm font-bold text-gray-600">{label}</span>
                            </label>
                          ))}
                          <label className="col-span-2 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-md cursor-pointer hover:border-border transition-colors">
                            <input type="checkbox"
                              checked={checklist.approval || false}
                              onChange={e => setChecklist(prev => ({ ...prev, approval: e.target.checked }))}
                              className="w-4 h-4 text-primary rounded focus:ring-gray-400 border-gray-300"
                            />
                            <span className="text-sm font-bold text-gray-600 flex items-center gap-2"><Paperclip size={14} /> Client Approval Attached / Verified</span>
                          </label>
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                          {(() => {
                            const requiredList = checklistConfig[selectedTask.productCategory] || ['Bleed Checked', 'CMYK Confirmed', 'Spelling Verified', 'Size Confirmed'];
                            const allMainChecks = requiredList.every((_, i) => checklist[`item_${i}`]);
                            const isComplete = allMainChecks && checklist.approval;

                            return (
                              <button
                                disabled={!isComplete}
                                onClick={async () => {
                                  const { confirmed } = await confirmDialog({ title: 'Send to Print', message: 'This will lock the task and send it to the print queue. Make sure all checks are done.', variant: 'success', confirmLabel: 'Send to Print' });
                                  if (confirmed) {
                                    updateStatus(selectedTask.realId, 'completed');
                                  }
                                }}
                                className="w-full py-4 rounded-md font-bold text-white flex items-center justify-center gap-2 transition-all
                             disabled:bg-gray-300 disabled:cursor-not-allowed bg-gray-900 hover:bg-gray-900 hover:scale-[1.01]"
                              >
                                {isComplete ? <><Printer size={20} /> Client Approved - Ready for Print</> : 'Complete Checklist to Finish'}
                              </button>
                            )
                          })()}
                          <p className="text-center text-xs text-gray-400 mt-2 font-medium uppercase tracking-wide">Prevents costly print mistakes</p>
                        </div>
                      </section>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-3 md:mb-1.5 border border-gray-100">
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
            <div className="w-full md:w-80 bg-white border-l h-full flex flex-col z-10 overflow-y-auto">

              {/* 1. Quick Task Summary */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 text-gray-900 font-bold mb-3">
                  <div className="p-1.5 bg-gray-900 text-white rounded-md">
                    <Zap size={16} />
                  </div>
                  <h2 className="text-sm">Quick Summary</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-3 rounded-md border ${overdueTasks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                    <p className={`text-2xl font-black ${overdueTasks.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>{overdueTasks.length}</p>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Overdue</p>
                  </div>
                  <div className="p-3 rounded-md bg-blue-50 border border-blue-100">
                    <p className="text-2xl font-black text-blue-600">{inProgressTasks.length}</p>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">In Progress</p>
                  </div>
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-100">
                    <p className="text-2xl font-black text-amber-600">{reviewTasks.length}</p>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">In Review</p>
                  </div>
                  <div className="p-3 rounded-md bg-green-50 border border-green-100">
                    <p className="text-2xl font-black text-green-600">{doneTasks.length}</p>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completed</p>
                  </div>
                </div>
              </div>

              {/* 2. My Stats */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 text-gray-900 font-bold mb-3">
                  <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                    <BarChart3 size={16} />
                  </div>
                  <h2 className="text-sm">My Stats</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-500" />
                      <span className="text-xs text-gray-600">Completed this week</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{completedThisWeek}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-blue-500" />
                      <span className="text-xs text-gray-600">Active tasks</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{tasks.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <span className="text-xs text-gray-600">Revision rate</span>
                    </div>
                    <span className={`text-sm font-black ${revisionRate > 30 ? 'text-red-600' : revisionRate > 15 ? 'text-amber-600' : 'text-green-600'}`}>{revisionRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-red-500" />
                      <span className="text-xs text-gray-600">Total revisions</span>
                    </div>
                    <span className="text-sm font-black text-gray-900">{totalRevisions}</span>
                  </div>
                </div>
              </div>

              {/* 3. Recent Notifications */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 pb-2">
                  <div className="flex items-center gap-2 text-gray-900 font-bold mb-1">
                    <div className="p-1.5 bg-orange-100 text-orange-600 rounded-md">
                      <Bell size={16} />
                    </div>
                    <h2 className="text-sm">Recent Notifications</h2>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  {sidebarNotifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Bell size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No recent notifications</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sidebarNotifications.map((notif: any) => (
                        <div key={notif.id} className={`p-3 rounded-md text-xs border ${notif.priority === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex items-start gap-2">
                            {notif.priority === 'urgent' ? (
                              <AlertCircle size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Bell size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-700 font-medium leading-relaxed">{notif.message}</p>
                              <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

    </>
  );
}

// Helper for download icon
function DownloadButton() {
  return (
    <button className="text-gray-400 hover:text-primary transition-colors">
      <div className="p-2 hover:bg-muted rounded-md transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
      </div>
    </button>
  );
}
