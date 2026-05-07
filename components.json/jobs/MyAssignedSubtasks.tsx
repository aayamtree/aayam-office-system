'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface SubtaskJob {
  id: string;
  job_number: string;
  project_name: string;
  client_deadline: string | null;
  priority: string;
  client?: { name: string; company?: string } | null;
}

interface MySubtask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'review' | 'done';
  due_date: string | null;
  job_id: string;
  job?: SubtaskJob | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-amber-100 text-amber-700',
};

export default function MyAssignedSubtasks() {
  const [subtasks, setSubtasks] = useState<MySubtask[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchMySubtasks = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/my-subtasks');
      if (res.ok) {
        const json = await res.json();
        setSubtasks(json.data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMySubtasks(); }, [fetchMySubtasks]);

  const handleStatusChange = async (id: string, status: string) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status: status as MySubtask['status'] } : s));
    await fetch(`/api/jobs/subtasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    // If marked done, remove from list after short delay
    if (status === 'done') {
      setTimeout(() => setSubtasks(prev => prev.filter(s => s.id !== id)), 800);
    }
  };

  if (loading) return null;
  if (subtasks.length === 0) return null;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2 px-1">
        <CheckSquare size={13} className="text-blue-600" />
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          My Subtasks ({subtasks.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {subtasks.map(s => {
          const isOverdue = s.due_date && s.due_date < today && s.status !== 'done';
          const job = s.job;
          const clientName = job?.client?.company || job?.client?.name || '';

          return (
            <div key={s.id} className={`bg-white rounded-md border px-3 py-2.5 flex items-center gap-2 ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              {/* Status */}
              <select
                value={s.status}
                onChange={e => handleStatusChange(s.id, e.target.value)}
                className={`text-[10px] font-bold rounded px-1.5 py-0.5 border-0 cursor-pointer shrink-0 ${STATUS_STYLES[s.status] || 'bg-gray-100 text-gray-500'}`}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done ✓</option>
              </select>

              {/* Subtask info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                {job && (
                  <p className="text-[10px] text-gray-400 truncate">
                    {job.job_number} · {job.project_name}
                    {clientName && ` · ${clientName}`}
                  </p>
                )}
              </div>

              {/* Due / overdue */}
              {s.due_date && (
                <span className={`text-[10px] shrink-0 font-medium ${isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                  {isOverdue ? '⚠ ' : ''}{new Date(s.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}

              {/* Link to job */}
              {job && (
                <Link
                  href={`/admin/jobs?highlight=${job.id}`}
                  className="text-gray-300 hover:text-primary shrink-0"
                  title="Open job"
                >
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
