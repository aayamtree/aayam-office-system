'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  Plus, Clock, CheckCircle2, ArrowRightLeft, Inbox,
  AlertCircle, Loader2, ChevronRight, Timer, Repeat2
} from 'lucide-react';

type TaskStatus = 'created' | 'live' | 'hold' | 'review' | 'rework' | 'end';

const STATUS_COLORS: Record<TaskStatus, string> = {
  created: 'bg-gray-100 text-gray-700',
  live:    'bg-green-100 text-green-700',
  hold:    'bg-orange-100 text-orange-700',
  review:  'bg-blue-100 text-blue-700',
  rework:  'bg-red-100 text-red-700',
  end:     'bg-emerald-100 text-emerald-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  normal:   'text-gray-500',
  urgent:   'text-orange-500',
  critical: 'text-red-600 font-bold',
};

interface Task {
  id: string;
  task_code: string;
  description: string;
  current_status: TaskStatus;
  priority: string;
  rework_count: number;
  deadline: string | null;
  created_at: string;
  assigned_to: string;
  created_by: string;
  client?: { name: string; company: string };
  product_type?: { name: string; category: string };
  assigned_user?: { id: string; full_name: string };
  task_time_sessions?: any[];
}

function TaskCard({ task, userId }: { task: Task; userId: string }) {
  const isTransferredOut = task.assigned_to !== userId && task.created_by === userId;
  const isTransferredIn  = false; // determined by task_transfers table separately

  // Calculate live time for open sessions
  const openSession = task.task_time_sessions?.find((s: any) => !s.session_end);
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!openSession) return;
    const start = new Date(openSession.session_start).getTime();
    setLiveSeconds(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => {
      setLiveSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [openSession]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.current_status !== 'end';

  return (
    <Link
      href={`/admin/designer-module/tasks/${task.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{task.task_code}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[task.current_status]}`}>
          {task.current_status}
        </span>
      </div>

      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{task.description}</p>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        {task.client && <span className="truncate">{task.client.company || task.client.name}</span>}
        {task.product_type && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{task.product_type.name}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {task.rework_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <Repeat2 size={12} /> Rework #{task.rework_count}
            </span>
          )}
          <span className={`text-xs capitalize ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {openSession && task.current_status === 'live' && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-mono font-semibold">
              <Timer size={12} className="animate-pulse" />
              {formatTime(liveSeconds)}
            </span>
          )}
          {isOverdue && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle size={12} /> Overdue
            </span>
          )}
          <ChevronRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {isTransferredOut && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-400">
          <ArrowRightLeft size={10} /> Transferred out — read only
        </div>
      )}
    </Link>
  );
}

function SectionHeader({ title, count, icon: Icon }: { title: string; count: number; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-gray-500" />
      <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{title}</h2>
      <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
    </div>
  );
}

export default function DesignerModulePage() {
  const { profile, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transferredIn, setTransferredIn] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/design-tasks');
      const json = await res.json();
      setTasks(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const userId = profile?.id || '';

  // Categorise tasks
  const myActiveTasks     = tasks.filter(t => t.assigned_to === userId && t.current_status !== 'end');
  const myCompletedTasks  = tasks.filter(t => t.assigned_to === userId && t.current_status === 'end');
  const transferredOut    = tasks.filter(t => t.assigned_to !== userId && t.created_by === userId);

  // For admin, show all tasks
  const adminActiveTasks  = isAdmin ? tasks.filter(t => t.current_status !== 'end') : [];
  const adminDoneTasks    = isAdmin ? tasks.filter(t => t.current_status === 'end') : [];

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Design Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your design workflow</p>
        </div>
        {(isAdmin || profile?.role === 'designer') && (
          <Link
            href="/admin/designer-module/new-task"
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> New Task
          </Link>
        )}
      </div>

      {/* Designer View */}
      {!isAdmin && (
        <>
          {/* My Active Tasks */}
          <div>
            <SectionHeader title="My Active Tasks" count={myActiveTasks.length} icon={Clock} />
            {myActiveTasks.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                <Inbox size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No active tasks — you&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myActiveTasks.map(t => <TaskCard key={t.id} task={t} userId={userId} />)}
              </div>
            )}
          </div>

          {/* Transferred Out */}
          {transferredOut.length > 0 && (
            <div>
              <SectionHeader title="Transferred Out" count={transferredOut.length} icon={ArrowRightLeft} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {transferredOut.map(t => <TaskCard key={t.id} task={t} userId={userId} />)}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {myCompletedTasks.length > 0 && (
            <div>
              <SectionHeader title="Completed Tasks" count={myCompletedTasks.length} icon={CheckCircle2} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {myCompletedTasks.map(t => <TaskCard key={t.id} task={t} userId={userId} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Admin View — all tasks */}
      {isAdmin && (
        <>
          <div>
            <SectionHeader title="All Active Tasks" count={adminActiveTasks.length} icon={Clock} />
            {adminActiveTasks.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                <Inbox size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No active tasks</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminActiveTasks.map(t => <TaskCard key={t.id} task={t} userId={userId} />)}
              </div>
            )}
          </div>

          {adminDoneTasks.length > 0 && (
            <div>
              <SectionHeader title="Completed Tasks" count={adminDoneTasks.length} icon={CheckCircle2} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                {adminDoneTasks.map(t => <TaskCard key={t.id} task={t} userId={userId} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
