'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useClients, useDesigners } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { extractFileIdFromLink, verifyDriveFile, formatBytes, getFileIcon, DriveFileInfo } from '@/lib/google-drive';
import { uploadToDrive } from '@/lib/google-drive-upload';
import { createCalendarEvent, createProjectCalendarEvent } from '@/lib/google-calendar';
import { Briefcase, Folder, Loader2, CheckCircle, ArrowLeft, Calendar, Upload, X, FileText, Image, File as FileIcon } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const { clients } = useClients();
    const { designers } = useDesigners();
    const [creating, setCreating] = useState(false);
    const [calendarEventCreated, setCalendarEventCreated] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    const [formData, setFormData] = useState({
        title: '',
        clientId: '',
        designerId: '',
        jobType: 'Design',
        deadline: '',
        priority: 'normal',
        driveLink: '',
        description: '',
        files: [] as File[]
    });

    // Drag & drop state
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drive verification state
    const [driveFileStatus, setDriveFileStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
    const [driveFileInfo, setDriveFileInfo] = useState<DriveFileInfo | null>(null);
    const [driveFileError, setDriveFileError] = useState<string>('');

    // Handle Drive link change with verification
    const handleDriveLinkChange = async (link: string) => {
        setFormData({ ...formData, driveLink: link });

        if (!link.trim()) {
            setDriveFileStatus('idle');
            setDriveFileInfo(null);
            setDriveFileError('');
            return;
        }

        // Extract file ID
        const fileId = extractFileIdFromLink(link);
        if (!fileId) {
            setDriveFileStatus('error');
            setDriveFileError('Invalid Google Drive link format');
            return;
        }

        // Verify file
        setDriveFileStatus('verifying');
        const result = await verifyDriveFile(fileId);

        if (result.success && result.file) {
            setDriveFileStatus('verified');
            setDriveFileInfo(result.file);
            setDriveFileError('');
        } else {
            setDriveFileStatus('error');
            setDriveFileError(result.error || 'Could not verify file');
        }
    };

    // Multi-file handlers
    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const fileArray = Array.from(newFiles);
        setFormData(prev => ({
            ...prev,
            files: [...prev.files, ...fileArray]
        }));
    }, []);

    const removeFile = useCallback((index: number) => {
        setFormData(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index)
        }));
    }, []);

    // Drag & drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    }, [addFiles]);

    // Get file icon based on type
    const getUploadFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <Image size={16} className="text-gray-500" />;
        if (file.type === 'application/pdf') return <FileText size={16} className="text-gray-500" />;
        return <FileIcon size={16} className="text-gray-500" />;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const jobData = {
                // Designer-provided fields
                project_name: formData.title,
                client_id: formData.clientId,
                designer_id: formData.designerId || user?.id,
                job_type: formData.jobType,
                client_deadline: formData.deadline || null,
                priority: formData.priority,
                drive_link: formData.driveLink || null,
                description: formData.description || null,
                current_stage: 'new' as const,
                status: 'active' as const,

                // Auto-generated/defaulted fields
                quantity: 1,
                quote_per_piece: 0,
                subtotal: 0,
                gst_rate: 0,
                gst_amount: 0,
                discount_amount: 0,
                total_amount: 0,
                payment_status: 'pending' as const,
                amount_received: 0,
                order_date: new Date().toISOString().split('T')[0],
                created_by: user?.id
            };

            const { data: newJob, error } = await supabase
                .from('jobs')
                .insert([jobData])
                .select()
                .single();

            if (error) throw error;

            // Upload files to Google Drive if any files selected and session is available
            if (formData.files.length > 0 && session?.accessToken) {
                const uploadedLinks: string[] = [];
                for (let i = 0; i < formData.files.length; i++) {
                    const file = formData.files[i];
                    setUploadProgress(`Uploading ${i + 1}/${formData.files.length}: ${file.name}`);

                    const result = await uploadToDrive(
                        session.accessToken,
                        file,
                        undefined, // folderId - optional
                        undefined, // fileName - use original
                        {
                            uploadedTo: `Design Project: ${formData.title}`,
                            resourceId: newJob.id
                        }
                    );

                    if (result.success && result.webViewLink) {
                        uploadedLinks.push(result.webViewLink);
                    }
                }

                // Update job with uploaded file links
                if (uploadedLinks.length > 0) {
                    const existingLink = formData.driveLink ? formData.driveLink + '\n' : '';
                    await supabase
                        .from('jobs')
                        .update({
                            drive_link: existingLink + uploadedLinks.join('\n')
                        })
                        .eq('id', newJob.id);
                }
                setUploadProgress('');
            }

            // Create Calendar event if user is signed in and has deadline
            if (session?.accessToken && formData.deadline) {
                const calendarEvent = createProjectCalendarEvent(
                    formData.title,
                    formData.deadline,
                    formData.description,
                    formData.driveLink
                );

                const eventResult = await createCalendarEvent(
                    session.accessToken,
                    calendarEvent
                );

                if (eventResult.success && eventResult.eventId) {
                    await supabase
                        .from('jobs')
                        .update({
                            calendar_event_id: eventResult.eventId,
                            calendar_event_link: eventResult.eventLink,
                        })
                        .eq('id', newJob.id);

                    setCalendarEventCreated(true);
                }
            }

            alert(session?.accessToken && formData.deadline
                ? 'Project created successfully! Calendar event added with reminders.'
                : 'Project created successfully!'
            );
            router.push('/admin/designers/my-queue');
        } catch (error: any) {
            console.error('Error creating project:', error);
            alert('Failed to create project: ' + error.message);
        } finally {
            setCreating(false);
            setUploadProgress('');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="relative bg-gray-900 overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
                <div className="relative max-w-5xl mx-auto p-4">
                    <Link
                        href="/admin/designers/my-queue"
                        className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
                    >
                        <ArrowLeft size={18} />
                        Back to My Queue
                    </Link>
                    <div className="flex items-start gap-2 md:gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur-lg rounded-md">
                            <Briefcase size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-page-title mb-1">Create New Project</h1>
                            <p className="text-white/80 text-sm">Initialize a new design or print job with all details</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <div className="max-w-5xl mx-auto p-4">
                {/* Calendar Integration Notice */}
                <div className="mb-1.5 p-4 bg-white border border-gray-200 rounded-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-gray-900" size={20} />
                            <div>
                                <h3 className="font-semibold text-gray-900">Google Calendar Integration</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    {session?.user ? (
                                        <span className="text-gray-900 font-semibold">
                                            Connected as {session.user.email}
                                        </span>
                                    ) : (
                                        'Sign in to auto-create calendar events with reminders'
                                    )}
                                </p>
                            </div>
                        </div>
                        {!session ? (
                            <button
                                type="button"
                                onClick={() => signIn('google')}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-semibold text-gray-900 flex items-center gap-2 text-sm"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Connect Google Calendar
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => signOut()}
                                className="text-sm text-gray-600 hover:text-gray-900"
                            >
                                Sign out
                            </button>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* 1. Project Basics */}
                    <div className="space-y-5 bg-white rounded-lg p-8 border border-gray-200">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-900 text-white text-section">
                                1
                            </div>
                            <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Project Basics</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    Project Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 transition-all font-medium hover:border-gray-300"
                                    placeholder="e.g. Wedding Invitation - Sharma Family"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    Client <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 transition-all bg-white hover:border-gray-300"
                                    value={formData.clientId}
                                    onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                                >
                                    <option value="">Select Client</option>
                                    {clients?.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    Assign Designer
                                </label>
                                <select
                                    className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 transition-all bg-white hover:border-gray-300"
                                    value={formData.designerId}
                                    onChange={e => setFormData({ ...formData, designerId: e.target.value })}
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
                    <div className="space-y-5 bg-white rounded-lg p-8 border border-gray-200">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-700 text-white text-section">
                                2
                            </div>
                            <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Project Parameters</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    Job Type
                                </label>
                                <select
                                    className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 bg-white hover:border-gray-300 transition-all"
                                    value={formData.jobType}
                                    onChange={e => setFormData({ ...formData, jobType: e.target.value })}
                                >
                                    <option value="Design">Design Only</option>
                                    <option value="Printing">Printing Only</option>
                                    <option value="Design + Printing">Design + Print</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    Deadline
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 font-medium text-gray-600 hover:border-gray-300 transition-all"
                                    value={formData.deadline}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    Priority
                                </label>
                                <select
                                    className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 bg-white hover:border-gray-300 transition-all"
                                    value={formData.priority}
                                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                >
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Assets & Brief */}
                    <div className="space-y-5 bg-white rounded-lg p-8 border border-gray-200">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-600 text-white text-section">
                                3
                            </div>
                            <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Assets & Brief</h4>
                        </div>

                        {/* Drive Link */}
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-4">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Folder size={18} className="text-gray-500" />
                                Google Drive Link
                            </label>
                            <input
                                type="url"
                                className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 placeholder:text-gray-400 bg-white hover:border-gray-300 transition-all"
                                placeholder="https://drive.google.com/drive/folders/..."
                                value={formData.driveLink}
                                onChange={e => handleDriveLinkChange(e.target.value)}
                            />

                            {/* Drive Verification Status */}
                            {driveFileStatus === 'verifying' && (
                                <div className="flex items-center gap-2 text-gray-600 text-sm">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Verifying file...</span>
                                </div>
                            )}

                            {driveFileStatus === 'verified' && driveFileInfo && (
                                <div className="bg-white p-4 rounded-md border border-green-200">
                                    <div className="flex items-start gap-3">
                                        <span className="text-3xl">{getFileIcon(driveFileInfo.mimeType)}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircle size={16} className="text-green-600" />
                                                <span className="text-gray-900 font-bold">Verified</span>
                                            </div>
                                            <p className="font-semibold text-gray-900 truncate">{driveFileInfo.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatBytes(driveFileInfo.size)}
                                                {driveFileInfo.modifiedTime && (
                                                    <span className="ml-2">Modified: {new Date(driveFileInfo.modifiedTime).toLocaleDateString()}</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {driveFileStatus === 'error' && driveFileError && (
                                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                                    <div className="flex items-start gap-2 text-red-700">
                                        <X size={18} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold">Cannot verify file</p>
                                            <p className="text-sm mt-1">{driveFileError}</p>
                                            <p className="text-xs mt-2 text-red-600">
                                                Make sure the file is shared with &quot;Anyone with the link&quot;
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* File Upload - Multi-file with Drag & Drop */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Upload size={18} className="text-gray-500" />
                                Upload Files to Google Drive
                            </label>

                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-all ${isDragging
                                    ? 'border-gray-900 bg-gray-100'
                                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                            >
                                <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                                <p className="text-sm font-medium text-gray-700">
                                    {isDragging ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Images, PDFs, documents — any file type
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={e => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            addFiles(e.target.files);
                                            e.target.value = ''; // Reset to allow re-selecting same files
                                        }
                                    }}
                                    className="hidden"
                                />
                            </div>

                            {/* File List */}
                            {formData.files.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        {formData.files.length} file{formData.files.length !== 1 ? 's' : ''} selected
                                    </p>
                                    {formData.files.map((file, index) => (
                                        <div
                                            key={`${file.name}-${index}`}
                                            className="flex items-center gap-3 bg-gray-50 rounded-md px-3 py-2 border border-gray-200"
                                        >
                                            {getUploadFileIcon(file)}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                                <p className="text-xs text-gray-500">{formatBytes(String(file.size))}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFile(index);
                                                }}
                                                className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                                            >
                                                <X size={14} className="text-gray-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Notice if not signed in */}
                            {!session?.accessToken && formData.files.length > 0 && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                    Sign in with Google Calendar above to upload files to Drive. Without sign-in, files won&apos;t be uploaded.
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <FileText size={16} className="text-gray-500" />
                                Description / Work Items
                            </label>
                            <textarea
                                rows={5}
                                className="w-full border border-gray-200 rounded-md px-4 py-2 text-base focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 leading-relaxed hover:border-gray-300 transition-all"
                                placeholder="Describe specific requirements, items to print, size, quantity, special instructions..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 md:gap-4 items-center justify-end bg-white rounded-md p-3 md:p-4 border border-gray-200 sticky bottom-4">
                        {uploadProgress && (
                            <div className="flex-1 flex items-center gap-2 text-sm text-gray-600">
                                <Loader2 size={16} className="animate-spin" />
                                <span>{uploadProgress}</span>
                            </div>
                        )}
                        <Link
                            href="/admin/designers/my-queue"
                            className="px-4 py-2 border border-gray-300 rounded-md font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all text-base"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={creating}
                            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md font-bold disabled:opacity-50 transition-all text-base flex items-center gap-2"
                        >
                            {creating ? <><Loader2 size={20} className="animate-spin" /> Creating...</> : <><CheckCircle size={20} /> Create Project</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
