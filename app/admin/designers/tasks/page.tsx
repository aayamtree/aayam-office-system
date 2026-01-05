'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Calendar, Clock, Edit, Trash2, Eye, X, ArrowLeft, ArrowRight, CheckCircle,
  AlertCircle, User, Briefcase, MessageSquare, Paperclip, ExternalLink,
  FileText, Image, Video, Music, File, ChevronRight, Save, Send, MoreHorizontal
} from 'lucide-react';

// --- MOCK DATA ---
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

const initialTasks = [
  {
    id: 1, taskId: 'TSK-001', title: 'Wedding Card - Gupta Family',
    clientName: 'Ramesh Gupta', status: 'in_progress', priority: 'high',
    deadline: '2025-12-28', description: 'Traditional red and gold theme. Needs 2 variations.',
    feedback: [
      { id: 1, text: 'Use bolder fonts for the names', date: 'Yesterday', by: 'Client' },
      { id: 2, text: 'Add Ganesha icon on top', date: 'Today', by: 'Admin' }
    ],
    driveLink: 'https://drive.google.com/...'
  },
  {
    id: 2, taskId: 'TSK-002', title: 'Brochure - Royal Prints',
    clientName: 'Royal Prints', status: 'pending', priority: 'normal',
    deadline: '2025-12-30', description: '8 Page layout for new machinery.',
    feedback: [],
    driveLink: ''
  },
  {
    id: 3, taskId: 'TSK-003', title: 'Logo Design - TechStart',
    clientName: 'TechStart Inc', status: 'rework', priority: 'urgent',
    deadline: '2025-12-26', description: 'Modern tech logo. Client rejected v1.',
    feedback: [
      { id: 1, text: 'Too simple. Needs more "tech" feel.', date: 'Today', by: 'Client' }
    ],
    driveLink: ''
  },
];

const initialLogs = [
  { id: 1, time: '10:00 AM', text: 'Started Gupta Wedding Card' },
  { id: 2, time: '12:30 PM', text: 'Sent Brochure for approval' },
];

export default function DesignerWorkspace() {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(1);
  const [logs, setLogs] = useState(initialLogs);
  const [newLog, setNewLog] = useState('');
  const [newFeedback, setNewFeedback] = useState('');

  // New Features State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [showTeamTasks, setShowTeamTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskData, setNewTaskData] = useState({ title: '', clientName: '', deadline: '', description: '', priority: 'normal' });

  // Filtering Logic
  const filteredTasks = tasks.filter(task => {
    // 1. Text Search (Project Name / Client / Date)
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.deadline.includes(searchQuery);

    // 2. Team vs My Tasks (Mock logic: In real app, check assigned_to)
    // For now, Team View shows ALL. My View shows only specific ones (mocked by ID even/odd for demo)
    const matchesView = showTeamTasks ? true : true; // In this mock, we act as if all are assigned to me for now.

    return matchesSearch && matchesView;
  });

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // --- ACTIONS ---
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskData.title || !newTaskData.clientName) return;

    const newTask = {
      id: Date.now(),
      taskId: `TSK-${tasks.length + 1}`.padStart(7, '0'),
      title: newTaskData.title,
      clientName: newTaskData.clientName,
      status: 'pending',
      priority: newTaskData.priority,
      deadline: newTaskData.deadline || new Date().toISOString().split('T')[0],
      description: newTaskData.description,
      feedback: [],
      driveLink: ''
    };

    setTasks([newTask, ...tasks]);
    setIsNewTaskModalOpen(false);
    setNewTaskData({ title: '', clientName: '', deadline: '', description: '', priority: 'normal' });
    setSelectedTaskId(newTask.id); // Select the new task
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
    if (!newFeedback.trim() || !selectedTask) return;

    const updatedTasks = tasks.map(t => {
      if (t.id === selectedTaskId) {
        return {
          ...t,
          feedback: [...t.feedback, { id: Date.now(), text: newFeedback, date: 'Just now', by: 'Me' }]
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    setNewFeedback('');
  };

  const updateStatus = (taskId: number, newStatus: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
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
              <p className="text-lg font-bold text-indigo-700">24 <span className="text-[10px] text-gray-400 font-normal">Tasks</span></p>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Last Month</p>
              <p className="text-lg font-bold text-gray-600">45 <span className="text-[10px] text-gray-400 font-normal">Tasks</span></p>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-200 p-0.5 rounded-lg">
            <button
              onClick={() => setShowTeamTasks(false)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!showTeamTasks ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              My Tasks
            </button>
            <button
              onClick={() => setShowTeamTasks(true)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${showTeamTasks ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Team View
            </button>
          </div>
        </div>

        <div className="p-4 border-b bg-gray-50/50">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Briefcase size={18} className="text-indigo-600" />
              {showTeamTasks ? 'Team Queue' : 'My Queue'}
            </h2>
            <button
              onClick={() => setIsNewTaskModalOpen(true)}
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1 text-xs font-bold px-3"
            >
              <Plus size={14} /> New Task
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
          {filteredTasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group relative overflow-hidden
                ${selectedTaskId === task.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
            >
              {selectedTaskId === task.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>}

              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[10px] text-gray-500 font-medium tracking-wide">{task.taskId}</span>
                {new Date(task.deadline) < new Date() ? (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={10} /> Overdue
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 font-medium">{task.deadline}</span>
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
          {filteredTasks.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <p>No tasks found.</p>
            </div>
          )}
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
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <User size={14} /> {selectedTask.clientName}
                  <span className="text-gray-300">|</span>
                  <Clock size={14} /> Due: {selectedTask.deadline}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border">
                  <span className="text-xs font-bold text-gray-500 pl-2 uppercase">Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => updateStatus(selectedTask.id, e.target.value)}
                    className="bg-transparent text-gray-700 text-sm rounded px-2 py-1 cursor-pointer focus:ring-0 border-none outline-none font-semibold hover:bg-white transition-colors"
                  >
                    {taskStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreHorizontal size={20} />
                </button>
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
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                          <File size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">Client_Logo_Final.ai</p>
                          <p className="text-xs text-gray-400">2.5 MB • Vector File</p>
                        </div>
                      </div>
                      <DownloadButton />
                    </div>
                    <button className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-xs font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                      <Plus size={14} /> Add Reference File
                    </button>
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
                    {selectedTask.feedback.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <MessageSquare size={48} className="mb-4 text-gray-200 opacity-50" />
                        <p className="text-sm font-medium">No feedback yet.</p>
                        <p className="text-xs text-gray-400 mt-1">Chat history will appear here.</p>
                      </div>
                    ) : (
                      selectedTask.feedback.map(f => (
                        <div key={f.id} className={`flex gap-4 ${f.by === 'Me' ? 'flex-row-reverse' : ''} group`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm ring-2 ring-white
                             ${f.by === 'Me' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-800 text-white'}`}>
                            {f.by.charAt(0)}
                          </div>
                          <div className={`max-w-[70%] space-y-1`}>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm
                                ${f.by === 'Me' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border text-gray-700 rounded-tl-none'}`}>
                              <p>{f.text}</p>
                            </div>
                            <p className={`text-[10px] font-medium px-1 ${f.by === 'Me' ? 'text-right text-indigo-300' : 'text-gray-400'}`}>
                              {f.date} • {f.by}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
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
        {/* Calendar Widget */}
        <div className="p-6 border-b bg-gradient-to-br from-white to-gray-50">
          <div className="flex items-center gap-2 mb-4 text-gray-900 font-bold">
            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
              <Calendar size={16} />
            </div>
            <h2>Schedule</h2>
          </div>
          {/* Simple Mini Calendar Visualization */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex justify-between mb-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <span>Mo</span><span>Tu</span><span>We</span><span className="text-indigo-600">Th</span><span>Fr</span><span>Sa</span><span>Su</span>
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center text-xs font-medium text-gray-600">
              <span className="opacity-30">29</span><span className="opacity-30">30</span>
              <span>1</span><span>2</span><span>3</span><span>4</span>
              <span className="w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded-full mx-auto shadow-md shadow-indigo-200">5</span>
              <span>6</span><span>7</span><span>8</span><span>9</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs space-y-2">
              <div className="flex items-center gap-2 text-gray-700 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                <span className="font-medium">2 Urgent Deadlines Tonight</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                <span className="font-medium">Gupta Wedding Delivery</span>
              </div>
            </div>
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

      {/* =================================================================================
          NEW TASK MODAL
         ================================================================================= */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 transform transition-all scale-100">
            <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-lg">Create New Task</h3>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Task Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wedding Invitation - Gupta"
                    value={newTaskData.title}
                    onChange={e => setNewTaskData({ ...newTaskData, title: e.target.value })}
                    className="w-full border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Client Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Gupta"
                      value={newTaskData.clientName}
                      onChange={e => setNewTaskData({ ...newTaskData, clientName: e.target.value })}
                      className="w-full border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Deadline</label>
                    <input
                      type="date"
                      value={newTaskData.deadline}
                      onChange={e => setNewTaskData({ ...newTaskData, deadline: e.target.value })}
                      className="w-full border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Priority</label>
                  <div className="flex gap-2">
                    {['normal', 'high', 'urgent'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskData({ ...newTaskData, priority: p })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-all
                           ${newTaskData.priority === p
                            ? (p === 'urgent' ? 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-200' : p === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200 ring-1 ring-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-200')
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Design Brief</label>
                  <textarea
                    rows={4}
                    placeholder="Enter details about the design requirements..."
                    value={newTaskData.description}
                    onChange={e => setNewTaskData({ ...newTaskData, description: e.target.value })}
                    className="w-full border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  Create Task
                </button>
              </div>
            </form>
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
