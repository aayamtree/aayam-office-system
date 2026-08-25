'use client';

import { useConfirm } from '@/components/ConfirmModal';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, Loader2, User } from 'lucide-react';
import { toast } from '@/lib/toast';

interface Assignee {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
}

interface Subtask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'review' | 'done';
  assigned_to: string | null;
  due_date: string | null;
  notes: string | null;
  sort_order: number;
  assignee?: Assignee | null;
}

interface Designer {
  id: string;
  name: string;
}

interface Props {
  jobId: string;
  designers: Designer[];
}

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-amber-100 text-amber-700',
  done:        'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
};

export default function JobSubtasks({ jobId, designers }: Props) {
  const confirm = useConfirm();
  const [subtasks, setSubtasks]         = useState<Subtask[]>([]);
  const [loading, setLoading]           = useState(true);
  const [adding, setAdding]             = useState(false);
  const [newTitle, setNewTitle]         = useState('');
  const [newAssignee, setNewAssignee]   = useState('');
  const [newDue, setNewDue]             = useState('');
  const [saving, setSaving]             = useState(false);

  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/subtasks`);
      if (res.ok) {
        const json = await res.json();
        setSubtasks(json.data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { fetchSubtasks(); }, [fetchSubtasks]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       newTitle.trim(),
          assigned_to: newAssignee || null,
          due_date:    newDue || null,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSubtasks(prev => [...prev, json.data]);
        setNewTitle('');
        setNewAssignee('');
        setNewDue('');
        setAdding(false);
      } else {
        toast.error('Could not add subtask');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    // Optimistic update
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, status: status as Subtask['status'] } : s));
    try {
      await fetch(`/api/jobs/subtasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch { toast.error('Failed to update'); }
  };

  const handleAssignChange = async (id: string, assigned_to: string) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, assigned_to: assigned_to || null } : s));
    try {
      await fetch(`/api/jobs/subtasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: assigned_to || null }),
      });
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: string) => {
    // Was optimistic with no dialog: the row vanished on the first click.
    const task = subtasks.find(s => s.id === id);
    const { confirmed } = await confirm({
      title: 'Delete this subtask?',
      message: task?.title || 'This subtask is removed permanently.',
      variant: 'danger', confirmLabel: 'Delete subtask',
    });
    if (!confirmed) return;
    setSubtasks(prev => prev.filter(s => s.id !== id));
    try {
      await fetch(`/api/jobs/subtasks/${id}`, { method: 'DELETE' });
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
      <Loader2 size={12} className="animate-spin" /> Loading subtasks…
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Check className="w-4 h-4 text-gray-500" />
          Subtasks
          {subtasks.length > 0 && (
            <span className="text-xs font-normal text-gray-400">
              ({subtasks.filter(s => s.status === 'done').length}/{subtasks.length} done)
            </span>
          )}
        </h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
          >
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      {/* Subtask list */}
      <div className="space-y-2">
        {subtasks.length === 0 && !adding && (
          <p className="text-xs text-gray-400 italic py-1">No subtasks yet — click Add to break this job into steps.</p>
        )}

        {subtasks.map(s => (
          <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 group">
            {/* Status chip */}
            <select
              value={s.status}
              onChange={e => handleStatusChange(s.id, e.target.value)}
              className={`text-[10px] font-bold rounded px-1.5 py-0.5 border-0 cursor-pointer ${STATUS_STYLES[s.status]}`}
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>

            {/* Title */}
            <span className={`flex-1 text-sm ${s.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {s.title}
            </span>

            {/* Assignee */}
            <select
              value={s.assigned_to || ''}
              onChange={e => handleAssignChange(s.id, e.target.value)}
              className="text-xs border-0 bg-transparent text-gray-500 max-w-[90px] truncate cursor-pointer"
            >
              <option value="">— assign</option>
              {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            {/* Due date */}
            {s.due_date && (
              <span className="text-[10px] text-gray-400 shrink-0">
                {new Date(s.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}

            {/* Delete */}
            <button
              onClick={() => handleDelete(s.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity shrink-0"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mt-2 p-3 rounded-md border border-dashed border-gray-300 bg-gray-50 space-y-2">
          <input
            autoFocus
            placeholder="Subtask title (e.g. Design, Proof, Pre-print check…)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
          />
          <div className="flex gap-2">
            <select
              value={newAssignee}
              onChange={e => setNewAssignee(e.target.value)}
              className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white"
            >
              <option value="">Assign to…</option>
              {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input
              type="date"
              value={newDue}
              onChange={e => setNewDue(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewTitle(''); setNewAssignee(''); setNewDue(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
              className="text-xs font-semibold bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
