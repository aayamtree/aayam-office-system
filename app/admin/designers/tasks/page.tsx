'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useJobs } from '@/lib/hooks';
import {
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, ArrowRight, CheckCircle,
  AlertCircle, User, Briefcase, MessageSquare, Paperclip, ExternalLink,
  FileText, Image, Video, Music, File, ChevronRight, Save, Send, MoreHorizontal,
  ChevronLeft, Loader2
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
  const { jobs, loading: jobsLoading, updateJobStage } = useJobs();

  // Local State
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [logs, setLogs] = useState(initialLogs);
  const [newLog, setNewLog] = useState('');
  const [newFeedback, setNewFeedback] = useState('');

  // UI State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [showTeamTasks, setShowTeamTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskData, setNewTaskData] = useState({ title: '', clientName: '', deadline: '', description: '', priority: 'normal', orderId: '' });

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // === DATA SYNC ===
  useEffect(() => {
    if (jobs) {
      const mappedTasks = jobs
        .filter(job => {
          // 1. Include only active design jobs or jobs relevant to design flow
          // 2. We keep Completed jobs for "Work Summary" calculations, even if hidden from active queue?
          // For now, let's load relevant stages.
          return ['new', 'designing', 'approval', 'printing', 'finishing', 'completed', 'delivered'].includes(job.current_stage);
        })
        .map(job => ({
          id: parseInt(job.id.substring(0, 8), 16) || Math.floor(Math.random() * 1000000), // Generate integer ID from UUID safely
          realId: job.id, // Keep real UUID
          taskId: job.job_number || 'JOB',
          title: job.project_name,
          clientName: job.client?.name || 'Unknown Client',
          status: getDesignerStatus(job.current_stage),
          priority: job.priority || 'normal',
          deadline: job.client_deadline || '',
          description: `Job Type: ${job.job_type}\nDetails: ${job.description || 'No description provided.'}`,
          feedback: [],
          driveLink: job.files?.[0] || '',
          orderId: job.id,
          designerId: job.designer_id,
          createdAt: job.created_at,
          current_stage: job.current_stage // Keep raw stage for updates
        }))
        // Sort: High priority first, then by deadline
        .sort((a, b) => {
          if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
          if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      setTasks(mappedTasks);

      // Auto-select first task if none selected and filtered view has tasks
      // (Handled in render logic or user interaction safest)
    }
  }, [jobs]);

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
    const matchesView = showTeamTasks ? true : (isAssignedToMe || !task.designerId);

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
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // 0 = Mon

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getTasksForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.deadline === dateStr);
  };

  // --- ACTIONS ---
  // Create Task (Now actually creates a JOB via hook if we unwired it, but for now mock action on local state is removed/replaced?)
  // User said "admin create new project", so Designer "Create Task" might be disabled OR it creates a 'Draft' job.
  // I will leave it as LOCAL for now, or alert "Only Admin can create projects".
  // But to be helpful, I'll log to console.
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Please ask Admin to create a new Project/Job. Designers manage active tasks.");
    setIsNewTaskModalOpen(false);
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
    <div className="h-[calc(100vh-4rem)] bg-gray-50 flex flex-col md:flex-row overflow-hidden">

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

          {/* View Tabs */}
          <div className="flex border-b border-gray-100 mt-4 mx-1">
            <button
              onClick={() => setShowTeamTasks(false)}
              className={`flex-1 pb-2 text-center text-xs font-bold border-b-2 transition-all ${!showTeamTasks ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setShowTeamTasks(true)}
              className={`flex-1 pb-2 text-center text-xs font-bold border-b-2 transition-all ${showTeamTasks ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Team Tasks
            </button>
          </div>
        </div>

        <div className="p-4 border-b bg-gray-50/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Briefcase size={18} className="text-indigo-600" />
              {showTeamTasks ? 'Team Queue' : 'My Queue'}
            </h2>
            {/* 
            <button 
              onClick={() => setIsNewTaskModalOpen(true)}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1 text-xs font-bold px-3 opacity-50 cursor-not-allowed"
              title="Only Admin creates new projects"
            >
              <Plus size={14} /> New Task
            </button>
            */}
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
          {jobsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <p>No tasks found.</p>
            </div>
          ) : filteredTasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group relative overflow-hidden
                ${selectedTaskId === task.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
            >
              {selectedTaskId === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}

              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[10px] text-gray-500 font-medium tracking-wide">{task.taskId}</span>
                {task.deadline && new Date(task.deadline) < new Date() ? (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={10} /> Overdue
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 font-medium">{task.deadline || 'No Deadline'}</span>
                )}
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
        {selectedTask ? (
          <>
            {/* Header */}
            <div className="px-8 py-5 border-b flex justify-between items-start bg-white sticky top-0 z-20">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-xl font-bold text-gray-900 leading-tight">{selectedTask.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border ${priorities.find(p => p.id === selectedTask.priority)?.color}`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <User size={14} /> {selectedTask.clientName}
                  </div>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} /> Due: {selectedTask.deadline || 'N/A'}
                  </div>
                  {/* Order ID Link if exists */}
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1.5 text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                    <FileText size={12} /> Ref Job: {selectedTask.taskId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border">
                  <span className="text-xs font-bold text-gray-500 pl-2 uppercase">Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateStatus(selectedTask.realId, e.target.value)}
                    className="bg-transparent text-gray-700 text-sm rounded px-2 py-1 cursor-pointer focus:ring-0 border-none outline-none font-semibold hover:bg-white transition-colors"
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

              {/* 2. Reference & Work Area */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* References */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Image size={16} className="text-blue-500" /> Reference Material
                  </h4>
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 cursor-pointer group transition-colors bg-gray-50/50">
                      {selectedTask.driveLink ? (
                        <a href={selectedTask.driveLink} target="_blank" className="flex items-center gap-3 w-full">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                            <File size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">Attached File</p>
                            <p className="text-xs text-gray-400">Click to open</p>
                          </div>
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400 italic p-2">No files attached.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* My Work */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Paperclip size={16} className="text-purple-500" /> My Submission
                  </h4>
                  <div className="space-y-4 flex-1">
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase">Project Link (Drive/Canva)</label>
                      <div className="flex gap-2 group focus-within:ring-2 ring-indigo-100 rounded-lg">
                        <input
                          type="text"
                          placeholder="https://..."
                          defaultValue={selectedTask.driveLink}
                          className="flex-1 text-sm border-gray-200 rounded-lg px-3 py-2.5 text-blue-600 font-medium placeholder:text-gray-300 focus:outline-none focus:border-indigo-500 transition-all"
                        />
                        <button className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors group">
                          <ExternalLink size={18} className="text-gray-500 group-hover:text-indigo-600" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-auto pt-2">
                      <button className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:from-indigo-700 hover:to-violet-700 transition-all flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 transform">
                        <Save size={18} /> Update & Save Progress
                      </button>
                    </div>
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
                const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth();
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
