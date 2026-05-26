'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import PairDropBanner from '@/components/layout/PairDropBanner';
import { DesignerStatusPills, DesignerStatusBadge } from '@/components/shared/DesignerStatusPills';

// --- HELPERS ---
const getDesignerStatus = (stage: string) => {
  const map: Record<string, string> = {
    'new': 'pending',
    'awaiting_admin': 'pending',  // Designer can see but not change stage
    'designing': 'in_progress',
    'file_check': 'in_progress',   // File Check — treat like active work
    'pre_print_qc': 'review',      // Pre Print QC — internal review
    'quality_check': 'review',     // Post-print QC
    'approval': 'waiting',         // Waiting for Client
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


// ─── Stable filter options hoisted outside component so they never recreate ───
// If defined inline inside the component, a new array is created on EVERY render,
// which causes SWR to schedule revalidations and floods the React event queue.
const JOBS_QUERY_OPTIONS = {
  select: '*, designer_status',
  filter: [{ column: 'current_stage', value: ['new', 'awaiting_admin', 'file_check', 'designing', 'approval', 'pre_print_qc', 'printing', 'finishing', 'quality_check', 'ready', 'delivered'] as string[], op: 'in' as const }],
  limit: 200
};

export default function DesignerWorkspace() {
  const { profile } = useAuth();
  const router = useRouter();

  // Safe URL param reader — avoids useSearchParams() which requires Suspense
  // and causes Next.js App Router to block client-side navigation when wrapping
  // an entire large page component.
  const [activeView, setActiveView] = useState<string>('');
  useEffect(() => {
    const readView = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveView(params.get('view') || '');
    };
    readView();
    window.addEventListener('popstate', readView);
    return () => window.removeEventListener('popstate', readView);
  }, []);
  const { jobs, loading: jobsLoading, error: jobsError, updateJobStage, createJob, updateJob, refetch: refetchJobs } = useJobs(JOBS_QUERY_OPTIONS);
  const { clients } = useClients();
  const { designers } = useDesigners();

  // Local State
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [sidebarNotifications, setSidebarNotifications] = useState<any[]>([]);


  // UI State



  /* Admin defaults to team_tasks, designers to board */
  const isAdmin = profile?.role === 'admin';
  const confirmDialog = useConfirm();
  const activeTab = activeView || (isAdmin ? 'team_tasks' : 'board');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Checklist State
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [checklistConfig, setChecklistConfig] = useState<Record<string, string[]>>({});
  // Print File Upload State
  const [printFileUploading, setPrintFileUploading] = useState(false);
  const [printFilesLocal, setPrintFilesLocal] = useState<{ name: string; url: string; size: number; type: string; uploaded_at: string; uploaded_by: string }[]>([]);

  useEffect(() => {
    const fetchChecklists = async () => {
      // PERF: Select only needed fields + limit — was unbounded select('*')
      const { data } = await supabase.from('job_checklists').select('job_type, items').limit(100);
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
    setPrintFilesLocal([]);
  }, [selectedTaskId]);

  // Handle ?action=new → redirect to dedicated page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      router.push('/admin/designers/new-project');
    }
  }, [router]);

  // Handle ?task=<id> → auto-select the task when navigating from Queue
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task');
    if (!taskId || !tasks.length) return;
    // task.realId is the raw Supabase UUID — match against what Queue passes in the URL
    const match = tasks.find((t: any) => t.realId === taskId);
    if (match) {
      setSelectedTaskId(match.id);
      // Switch to list view so the task detail panel is visible
      if (!activeView || activeView === 'board') {
        setActiveView(isAdmin ? 'team_tasks' : 'my_tasks');
      }
      // Clean the URL so back-navigation works cleanly
      const cleanUrl = window.location.pathname + (activeView && activeView !== 'board' ? `?view=${activeView}` : '');
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [tasks, activeView, isAdmin]);

  // NOTE: Daily Briefing is handled globally by DailyBriefingTrigger in layout.tsx — no duplicate here needed

  // Update Priority
  const updatePriority = async (realId: string, priority: string) => {
    if (updateJob) {
      await updateJob(realId, { priority: priority as any });
    }
  };

  const setView = useCallback((view: string) => {
    setActiveView(view);  // update state immediately — popstate only fires on back/forward, NOT router.push
    router.push(`/admin/designers/tasks?view=${view}`);
  }, [router]);

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
        .filter(job => ['new', 'awaiting_admin', 'file_check', 'designing', 'approval', 'pre_print_qc', 'printing', 'finishing', 'completed', 'delivered'].includes(job.current_stage || ''))
        .filter(job => !['Print Only', 'print_only'].includes(job.job_type || '')) // Print Only jobs don't need design work
        .map(job => {
          // Resolve Relationships (Manual Join)
          const client = (clients || []).find(c => c.id === job.client_id);
          const designer = (designers || []).find(d => d.id === job.designer_id);

          return {
            id: parseInt(job.id.replace(/-/g, '').substring(0, 8), 16) || job.id.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0),
            realId: job.id,
            taskId: job.job_number || 'JOB',
            title: job.project_name,
            clientName: client?.company || client?.name || 'Unknown Client',
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
            designerName: designer?.full_name || designer?.name || 'Unassigned',
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
            designer_status: (job as any).designer_status || null,  // live/hold/review/end
            status: job.is_on_hold ? 'on_hold' : getDesignerStatus(job.current_stage)
          };
        })
        .sort((a, b) => {
          if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      setTasks(mappedTasks);
    }
  }, [JSON.stringify(jobs?.map(j => ({ id: j.id, files: j.files, print_files: (j as any).print_files }))), JSON.stringify(clients?.map(c => c.id)), JSON.stringify(designers?.map(d => d.id))]);

  // --- LOGIC (memoized to prevent recomputation on every render) ---
  // Pre-compute myDesignerRecord once instead of inside filteredTasks per-task
  const myDesignerRecord = useMemo(() => designers.find((d: any) => d.id === profile?.id), [designers, profile?.id]);

  const filteredTasks = useMemo(() => tasks.filter(task => {
    const matchesSearch =
      (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.jobType && task.jobType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.productCategory && task.productCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.deadline && task.deadline.includes(searchQuery));

    const isAssignedToMe = myDesignerRecord ? task.designerId === myDesignerRecord.id : task.designerId === profile?.id;

    let matchesView = false;
    if (activeTab === 'team_tasks') {
      matchesView = true;
    } else if (activeTab === 'my_tasks') {
      if (isAdmin) {
        matchesView = true;
      } else {
        matchesView = isAssignedToMe || !task.designerId;
      }
    } else {
      matchesView = true;
    }

    return matchesSearch && matchesView;
  }), [tasks, searchQuery, myDesignerRecord, activeTab, isAdmin, profile?.id]);

  const selectedTask = useMemo(() => tasks.find(t => (t.id === selectedTaskId) || (t.realId === selectedTaskId)), [tasks, selectedTaskId]);

  // All stats memoized — computed once when tasks change, not on every render
  const { thisMonthCount, lastMonthCount, completedThisWeek, totalRevisions, revisionRate, overdueTasks, inProgressTasks, reviewTasks, doneTasks } = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const printStages = ['printing', 'finishing', 'quality_check', 'ready', 'delivered'];

    let _thisMonth = 0, _lastMonth = 0, _completedWeek = 0, _totalRevisions = 0, _withRevisions = 0;
    const _overdue: any[] = [], _inProgress: any[] = [], _review: any[] = [], _done: any[] = [];

    for (const t of tasks) {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      if (created) {
        const m = created.getMonth(), y = created.getFullYear();
        if (m === thisMonth && y === thisYear) _thisMonth++;
        if (m === thisMonth - 1 && y === thisYear) _lastMonth++;
        if (printStages.includes(t.current_stage || '') && created.getTime() >= weekAgoMs) _completedWeek++;
      }
      _totalRevisions += (t.revision_count || 0);
      if ((t.revision_count || 0) > 0) _withRevisions++;
      if (t.deadline && new Date(t.deadline).getTime() < nowMs && !printStages.includes(t.current_stage || '')) _overdue.push(t);
      if (t.status === 'in_progress') _inProgress.push(t);
      if (t.status === 'review') _review.push(t);
      if (printStages.includes(t.current_stage || '')) _done.push(t);
    }

    return {
      thisMonthCount: _thisMonth,
      lastMonthCount: _lastMonth,
      completedThisWeek: _completedWeek,
      totalRevisions: _totalRevisions,
      revisionRate: tasks.length > 0 ? Math.round((_withRevisions / tasks.length) * 100) : 0,
      overdueTasks: _overdue,
      inProgressTasks: _inProgress,
      reviewTasks: _review,
      doneTasks: _done,
    };
  }, [tasks]);

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
        const { error: updateError } = await updateJob(selectedTask.realId, { files: updatedFiles } as any);

        if (updateError) {
          // Storage upload succeeded but DB save failed — surface the real error
          toast.error(`File saved to storage but could not update job record: ${updateError}`);
          return;
        }

        // Log upload to activity feed
        logFileUpload({ fileName: file.name, fileSize: file.size, fileType: file.type, fileUrl: publicUrl, uploadedTo: `Job ${selectedTask.taskId}`, resourceId: selectedTask.realId });

        // Notify assigned designer if someone else uploaded
        const myDesignerRec = designers.find((d: any) => d.id === profile?.id);
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

        // Optimistically update tasks state so file appears immediately
        setTasks(prev => prev.map(t => t.realId === selectedTask.realId ? { ...t, files: updatedFiles } : t));
        refetchJobs();
        toast.success('File uploaded successfully!');
      }

    } catch (e: any) {
      toast.error(String('Upload failed: ' + e.message));
    }
  };

  // --- PRINT FILE UPLOAD (multiple files supported) ---
  const handlePrintFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedTask) return;
    const file = e.target.files[0];
    const allowedExts = ['pdf', 'ai', 'eps', 'psd', 'tiff', 'tif', 'cdr', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExts.includes(ext)) {
      toast.error('Invalid file type. Please upload PDF, AI, EPS, PSD, TIFF, CDR, or PNG.');
      return;
    }
    setPrintFileUploading(true);
    try {
      const safeName = `print-file-${selectedTask.realId}-${Date.now()}.${ext}`;
      const filePath = `print-files/${selectedTask.realId}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from('files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('files').getPublicUrl(filePath);

      const newEntry = {
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type,
        uploaded_at: new Date().toISOString(),
        uploaded_by: profile?.full_name || 'designer',
      };

      // Fetch existing print_files array and append
      if (updateJob) {
        const { data: existing } = await supabase.from('jobs').select('print_files').eq('id', selectedTask.realId).single();
        const existingArr = Array.isArray(existing?.print_files) ? existing.print_files : [];
        const updatedArr = [...existingArr, newEntry];
        await updateJob(selectedTask.realId, { print_files: updatedArr } as any);
        setPrintFilesLocal(updatedArr);
      }

      // Rich activity log
      const { logActivity } = await import('@/lib/logger');
      const clientDisplay = [selectedTask.client?.company, selectedTask.client?.name]
        .filter(Boolean).join(' / ') || 'Unknown Client';
      logActivity(
        'print_file_upload',
        'print_file',
        selectedTask.realId,
        `Print File submitted: "${file.name}" for ${selectedTask.title} (${selectedTask.taskId}) — Client: ${clientDisplay}. By: ${profile?.full_name || 'designer'} | ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: publicUrl,
          jobNumber: selectedTask.taskId,
          projectName: selectedTask.title,
          clientName: selectedTask.client?.name || '',
          companyName: selectedTask.client?.company || '',
          uploadedBy: profile?.full_name || '',
        },
        profile?.id
      );

      // Broadcast notification
      await supabase.from('broadcast_notifications').insert({
        message: `🖨️ Print File Ready: "${file.name}" submitted for ${selectedTask.title} (${selectedTask.taskId}) — ${clientDisplay}. Uploaded by ${profile?.full_name || 'designer'}.`,
        priority: 'high',
        target_audience: 'admin',
        created_by: profile?.id,
      });

      refetchJobs();
      toast.success('✅ Print file uploaded! Admin & Dispatch have been notified.');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setPrintFileUploading(false);
      e.target.value = '';
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

  // One-click approve for admin: approve a job that's awaiting_admin
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null);
  // Track locally-approved jobs so the button hides instantly even before the
  // refetch lands. Prevents double-click from hitting the API twice.
  const [locallyProcessedIds, setLocallyProcessedIds] = useState<Set<string>>(new Set());
  const approveJob = async (realId: string, action: 'approve' | 'reject') => {
    // Guard: don't re-send if already processed in this session
    if (locallyProcessedIds.has(realId) || approvingJobId === realId) return;
    setApprovingJobId(realId);
    try {
      const res = await fetch(`/api/jobs/${realId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      // Mark processed so the approve/reject buttons hide immediately
      setLocallyProcessedIds(prev => {
        const next = new Set(prev);
        next.add(realId);
        return next;
      });
      if (json.alreadyProcessed) {
        toast.success('Job was already processed — refreshing list');
      } else {
        toast.success(action === 'approve' ? '✅ Job approved — started designing!' : '❌ Job rejected');
      }
      await refetchJobs(); // refresh jobs list (awaited so loading state clears only after data lands)
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApprovingJobId(null);
    }
  };

  return (
    <>

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
                            onClick={() => { setSelectedTaskId(task.id); setView('my_tasks'); }}
                            className="bg-white rounded-md overflow-hidden border border-gray-200 transition-shadow cursor-pointer hover:shadow-md"
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
                              {/* Awaiting Admin badge + one-click approve for admins */}
                              {task.current_stage === 'awaiting_admin' && !locallyProcessedIds.has(task.realId) && (
                                <div className="mb-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-300">⏳ Awaiting Approval</span>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); approveJob(task.realId, 'approve'); }}
                                        disabled={approvingJobId === task.realId}
                                        className="flex items-center gap-0.5 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                                      >
                                        {approvingJobId === task.realId ? <Loader2 size={9} className="animate-spin" /> : null}
                                        ✓ Approve
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); approveJob(task.realId, 'reject'); }}
                                        disabled={approvingJobId === task.realId}
                                        className="px-2.5 py-1 text-red-600 text-[10px] font-bold rounded bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                                      >
                                        ✗ Reject
                                      </button>
                                    </div>
                                  )}
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
                                  {/* Designer Status Badge */}
                                  <DesignerStatusBadge status={task.designer_status} />
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
                          {/* Bar — deterministic progress based on actual dates, NOT Math.random() */}
                          <div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : 'bg-gray-700'}`} style={{ width: (() => { const s = new Date(task.createdAt).getTime(); const e = task.rawDeadline ? new Date(task.rawDeadline).getTime() : Date.now() + 86400000; const elapsed = Math.max(0, Date.now() - s); const total = Math.max(e - s, 86400000); return Math.min(100, Math.round((elapsed / total) * 100)) + '%'; })() }}></div>
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

                {/* PairDrop quick-link — shows only when URL is configured */}
                <PairDropBanner />

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
                      <DesignerStatusBadge status={task.designer_status} />
                      <div className="flex items-center gap-1.5">
                        {(task.files?.length > 0 || task.driveLink) && (
                          <span className="flex items-center gap-0.5 text-gray-400" title={`${task.files?.length || 1} file(s) attached`}>
                            <Paperclip size={11} />
                            <span className="text-xs font-bold">{task.files?.length || 1}</span>
                          </span>
                        )}
                        {task.priority !== 'normal' && (
                          <span className={`text-xs px-2 py-0.5 rounded-md border ${priorities.find(p => p.id === task.priority)?.color}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* One-click approve (admin only) */}
                    {isAdmin && task.current_stage === 'awaiting_admin' && !locallyProcessedIds.has(task.realId) && (
                      <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => approveJob(task.realId, 'approve')}
                          disabled={approvingJobId === task.realId}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-md transition-colors disabled:opacity-50"
                        >
                          {approvingJobId === task.realId ? <Loader2 size={12} className="animate-spin" /> : null}
                          ✓ Approve Job
                        </button>
                        <button
                          onClick={() => approveJob(task.realId, 'reject')}
                          disabled={approvingJobId === task.realId}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-md transition-colors disabled:opacity-50"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
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
                  <div className="px-6 py-3 border-b flex flex-col md:flex-row md:justify-between md:items-center bg-white sticky top-0 z-20 gap-2 md:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                        <span className="text-section text-gray-900 leading-tight">{selectedTask.title}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5 min-w-fit">
                          <User size={14} /> <span className="truncate max-w-[150px]">{selectedTask.clientName}</span>
                        </div>
                        <span className="hidden md:inline text-gray-300">|</span>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <Clock size={14} /> Due: {selectedTask.deadline || 'N/A'}
                        </div>
                        {/* Order ID Link if exists */}
                        <span className="hidden md:inline text-gray-300">|</span>
                        <div className="flex items-center gap-1.5 text-primary font-medium bg-muted px-2 py-0.5 rounded-md whitespace-nowrap">
                          <FileText size={12} /> Ref: {selectedTask.taskId}
                        </div>
                      </div>
                    </div>

                      {/* Priority Update */}
                      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border shrink-0">
                        <span className="text-xs font-bold text-gray-500 pl-2 uppercase whitespace-nowrap">Priority:</span>
                        <select
                          value={selectedTask.priority}
                          onChange={(e) => updatePriority(selectedTask.realId, e.target.value)}
                          className={`bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer outline-none uppercase ${priorities.find(p => p.id === selectedTask.priority)?.color?.replace('bg-', 'text-')}`}
                        >
                          {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">

                    {/* Task Status Pills — moved here so header stays slim */}
                    <div className={`rounded-md border ${selectedTask.is_on_hold
                      ? 'bg-amber-500 border-amber-500'
                      : ['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(selectedTask.current_stage || '')
                        ? 'bg-gray-900 border-gray-900'
                        : 'bg-white border-gray-200'
                      }`}>
                      {selectedTask.is_on_hold ? (
                        <span className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2.5">
                          ⏸️ ON HOLD
                        </span>
                      ) : ['printing', 'finishing', 'quality_check', 'ready', 'delivered'].includes(selectedTask.current_stage || '') ? (
                        <span className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2.5">
                          <Lock size={13} /> {(() => {
                            const jt = (selectedTask.jobType || '').toLowerCase();
                            const isDesignOnlyLocked = jt.includes('design') && !jt.includes('print');
                            return isDesignOnlyLocked ? 'Locked — Design Delivered' : 'Locked — Sent to Print';
                          })()}
                        </span>
                      ) : (
                        <DesignerStatusPills
                          jobId={selectedTask.realId}
                          currentStatus={selectedTask.designer_status}
                          size="bar"
                          userRole={profile?.role}
                          currentUserId={profile?.id}
                          assignedDesignerId={selectedTask.designerId}
                          onStatusChange={(s) => {
                            setTasks(prev => prev.map(t =>
                              t.realId === selectedTask.realId ? { ...t, designer_status: s } : t
                            ));
                          }}
                          designers={designers?.map((d: any) => ({ id: d.id, full_name: d.full_name || d.name || d.email }))}
                        />
                      )}
                    </div>

                    {/* Admin Freeze / Resume Control */}
                    {isAdmin && (
                      <div className={`flex items-center justify-between px-4 py-3 rounded-md border ${selectedTask.is_on_hold ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          {selectedTask.is_on_hold ? (
                            <>
                              <span className="text-amber-600 font-bold text-sm">⏸️ Job is Frozen</span>
                              {selectedTask.hold_reason && <span className="text-xs text-amber-700 italic">— {selectedTask.hold_reason}</span>}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">Admin Control</span>
                          )}
                        </div>
                        {selectedTask.is_on_hold ? (
                          <button
                            onClick={async () => {
                              const { confirmed } = await confirmDialog({ title: 'Resume Project', message: 'This will resume the project and move it back to its previous stage.', variant: 'success', confirmLabel: 'Resume' });
                              if (!confirmed) return;
                              await supabase.from('jobs').update({
                                is_on_hold: false,
                                current_stage: ['printing', 'finishing', 'quality_check', 'ready', 'delivered', 'sent_to_print', 'approval'].includes(selectedTask.pre_hold_stage || '')
                                  ? 'designing'
                                  : selectedTask.pre_hold_stage || 'designing',
                                hold_reason: null,
                                pre_hold_stage: null,
                              }).eq('id', selectedTask.realId);
                              const userName = profile?.full_name || 'Admin';
                              await supabase.from('job_notes').insert([{ job_id: selectedTask.realId, user_id: profile?.id, content: `▶️ Project resumed by ${userName}. Back to ${selectedTask.pre_hold_stage || 'designing'}.`, tag: 'update', source: 'self' }]);
                              await supabase.from('job_stage_history').insert([{ job_id: selectedTask.realId, from_stage: 'on_hold', to_stage: selectedTask.pre_hold_stage || 'designing', notes: `▶️ Resumed by ${userName}` }]);
                              await logActivity({ action: 'update', resourceType: 'job', resourceId: selectedTask.realId, details: { description: `▶️ ${selectedTask.taskId} resumed by ${userName}.`, holdAction: 'resume' } });
                              refetchJobs();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-bold hover:bg-green-700 transition-colors"
                          >
                            ▶️ Resume Job
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const { confirmed, inputValue } = await confirmDialog({ title: 'Freeze Job', message: 'This will freeze the job. The designer won\'t be able to work on it until you resume.', variant: 'warning', confirmLabel: 'Freeze', showInput: true, inputPlaceholder: 'Why are you freezing this job?', inputRequired: true });
                              if (!confirmed || !inputValue) return;
                              const reason = inputValue;
                              await supabase.from('jobs').update({ is_on_hold: true, hold_reason: reason, pre_hold_stage: selectedTask.current_stage || 'designing' }).eq('id', selectedTask.realId);
                              const userName = profile?.full_name || 'Admin';
                              await supabase.from('job_notes').insert([{ job_id: selectedTask.realId, user_id: profile?.id, content: `⏸️ Job frozen by ${userName}. Reason: "${reason}"`, tag: 'update', source: 'self' }]);
                              await supabase.from('job_stage_history').insert([{ job_id: selectedTask.realId, from_stage: selectedTask.current_stage || 'designing', to_stage: 'on_hold', notes: `⏸️ Frozen: ${reason}` }]);
                              await logActivity({ action: 'update', resourceType: 'job', resourceId: selectedTask.realId, details: { description: `⏸️ ${selectedTask.taskId} frozen by ${userName}. Reason: "${reason}"`, holdAction: 'hold' } });
                              refetchJobs();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-md text-xs font-bold hover:bg-amber-200 border border-amber-300 transition-colors"
                          >
                            ⏸️ Freeze Job
                          </button>
                        )}
                      </div>
                    )}

                    {/* Cross-Designer Warning Banner — only show when user is truly not the assigned designer */}
                    {(() => {
                      if (!profile) return null; // wait for auth to load
                      // job.designer_id stores the profile/auth user UUID
                      // so we can directly compare with the current user's profile id
                      const isMyJob = selectedTask.designerId === profile.id;
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



                    {/* 5. Final Review, Print File & Checklist — hidden when locked or on hold */}
                    {!selectedTask.is_on_hold && !['printing', 'finishing', 'quality_check', 'ready', 'delivered', 'completed'].includes(selectedTask.current_stage || '') && (
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

                        {(() => {
                          // Detect Design Only job (no printing step)
                          const jobTypeLower = (selectedTask.jobType || '').toLowerCase();
                          const isDesignOnly = jobTypeLower.includes('design') && !jobTypeLower.includes('print');

                          const requiredList3 = checklistConfig[selectedTask.productCategory] || ['Bleed Checked', 'CMYK Confirmed', 'Spelling Verified', 'Size Confirmed'];
                          const allChecked = requiredList3.every((_, i) => checklist[`item_${i}`]) && checklist.approval;
                          const savedFiles: any[] = Array.isArray((selectedTask as any).print_files) ? (selectedTask as any).print_files : [];
                          const displayFiles = printFilesLocal.length > 0 ? printFilesLocal : savedFiles;

                          // For Design Only: skip print-file upload zone
                          return (
                            <>
                              {!isDesignOnly && (
                                <div className={`rounded-md border-2 p-3 space-y-2 transition-all ${allChecked ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-gray-50 opacity-50 pointer-events-none'
                                  }`}>
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-xs font-bold text-blue-700 uppercase tracking-widest flex items-center gap-2">
                                      <Printer size={13} /> Print File Submission
                                      {!allChecked && <span className="text-gray-400 font-normal normal-case tracking-normal">— complete checklist first</span>}
                                    </h5>
                                    {displayFiles.length > 0 && (
                                      <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{displayFiles.length} file{displayFiles.length > 1 ? 's' : ''}</span>
                                    )}
                                  </div>
                                  {/* Uploaded file list */}
                                  {displayFiles.length > 0 && (
                                    <div className="space-y-1.5">
                                      {displayFiles.map((f: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-md border border-blue-100">
                                          <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800 truncate">{f.name}</p>
                                            <p className="text-[10px] text-gray-400">{f.uploaded_by} · {f.size ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : ''}</p>
                                          </div>
                                          <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 flex-shrink-0">
                                            <ExternalLink size={10} /> Open
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Upload zone */}
                                  <label className={`flex items-center justify-center gap-2 py-3 rounded-md border-2 border-dashed cursor-pointer transition-colors ${allChecked ? 'border-blue-300 bg-white hover:bg-blue-50' : 'border-gray-200'
                                    }`}>
                                    {printFileUploading ? (
                                      <><Loader2 size={16} className="animate-spin text-blue-500" /><span className="text-sm text-blue-500 font-semibold">Uploading...</span></>
                                    ) : (
                                      <><Upload size={16} className="text-blue-400" />
                                        <span className="text-sm font-bold text-gray-700">{displayFiles.length > 0 ? '+ Add More Files' : 'Upload Print File'}</span>
                                        <span className="text-xs text-gray-400">PDF · AI · EPS · PSD · TIFF</span></>
                                    )}
                                    <input type="file" className="hidden" accept=".pdf,.ai,.eps,.psd,.tiff,.tif,.cdr,.png" onChange={handlePrintFileUpload} disabled={printFileUploading} />
                                  </label>
                                  <p className="text-[10px] text-center text-gray-400">Admin &amp; Dispatch notified on every upload</p>
                                </div>
                              )}

                              {isDesignOnly && allChecked && (
                                <div className="rounded-md border-2 border-green-200 bg-green-50/40 p-3">
                                  <p className="text-xs font-bold text-green-700 flex items-center gap-2">
                                    <CheckCircle size={13} /> Pre-Print QC complete — ready to deliver design file to client.
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        <div className="pt-4 border-t border-gray-200">
                          {(() => {
                            // Detect Design Only job
                            const jobTypeLower = (selectedTask.jobType || '').toLowerCase();
                            const isDesignOnly = jobTypeLower.includes('design') && !jobTypeLower.includes('print');

                            const requiredList = checklistConfig[selectedTask.productCategory] || ['Bleed Checked', 'CMYK Confirmed', 'Spelling Verified', 'Size Confirmed'];
                            const allMainChecks = requiredList.every((_, i) => checklist[`item_${i}`]);
                            const isComplete = allMainChecks && checklist.approval;
                            const savedFiles2: any[] = Array.isArray((selectedTask as any).print_files) ? (selectedTask as any).print_files : [];
                            const hasFile = printFilesLocal.length > 0 || savedFiles2.length > 0;
                            // Design Only: only needs checklist completion (no print file)
                            const canSubmit = isDesignOnly ? isComplete : (isComplete && hasFile);

                            return (
                              <>
                                <button
                                  disabled={!canSubmit}
                                  onClick={async () => {
                                    if (isDesignOnly) {
                                      const { confirmed } = await confirmDialog({ title: 'Mark as Delivered', message: 'This will mark the design as delivered. The Pre-Print QC is complete and the design file is ready for the client.', variant: 'success', confirmLabel: 'Mark Delivered' });
                                      if (confirmed) {
                                        if (updateJobStage) await updateJobStage(selectedTask.realId, 'delivered');
                                        refetchJobs();
                                      }
                                    } else {
                                      const { confirmed } = await confirmDialog({ title: 'Send to Print', message: 'This will lock the task and send it to the print queue. Make sure all checks are done and print file is uploaded.', variant: 'success', confirmLabel: 'Send to Print' });
                                      if (confirmed) {
                                        updateStatus(selectedTask.realId, 'completed');
                                      }
                                    }
                                  }}
                                  className="w-full py-4 rounded-md font-bold text-white flex items-center justify-center gap-2 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed bg-gray-900 hover:bg-gray-900 hover:scale-[1.01]"
                                >
                                  {isDesignOnly ? (
                                    canSubmit
                                      ? <><CheckCircle size={20} /> Pre-Print QC Done – Mark as Delivered</>
                                      : 'Complete Checklist to Finish'
                                  ) : (
                                    canSubmit
                                      ? <><Printer size={20} /> Client Approved – Ready for Print</>
                                      : isComplete
                                        ? '⬆️ Upload Print File to Proceed'
                                        : 'Complete Checklist to Finish'
                                  )}
                                </button>
                                {!isDesignOnly && !hasFile && isComplete && (
                                  <p className="text-center text-xs text-amber-500 mt-1.5 font-semibold">⚠ Upload at least 1 print file before sending to print</p>
                                )}
                              </>
                            );
                          })()}
                          <p className="text-center text-xs text-gray-400 mt-2 font-medium uppercase tracking-wide">Prevents costly print mistakes</p>
                        </div>
                      </section>
                    )}

                    {/* ─── PRINT FILES (read-only) — shown once job is sent to print/completed ─── */}
                    {['printing', 'finishing', 'quality_check', 'ready', 'delivered', 'completed'].includes(selectedTask.current_stage || '') && (() => {
                      const savedFiles: any[] = Array.isArray((selectedTask as any).print_files) ? (selectedTask as any).print_files : [];
                      if (savedFiles.length === 0) return null;
                      return (
                        <section className="p-4 rounded-md border border-gray-200 bg-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                              <Lock size={13} /> Print Files Submitted
                            </h5>
                            <span className="text-xs bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded-full">{savedFiles.length} file{savedFiles.length > 1 ? 's' : ''} · Locked</span>
                          </div>
                          <div className="space-y-1.5">
                            {savedFiles.map((f: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-100">
                                <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-800 truncate">{f.name}</p>
                                  <p className="text-[10px] text-gray-400">{f.uploaded_by} · {f.size ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : ''}</p>
                                </div>
                                <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 flex-shrink-0">
                                  <ExternalLink size={10} /> Open
                                </a>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })()}

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


