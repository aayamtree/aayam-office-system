'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { useDesigners, useProductCategories } from '@/lib/hooks';
import { getProjectTypeCode } from '@/lib/job-workflow';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { extractFileIdFromLink, verifyDriveFile, formatBytes, getFileIcon, DriveFileInfo } from '@/lib/google-drive';
import { uploadToDrive, getProjectFolder } from '@/lib/google-drive-upload';
import { createCalendarEvent, createProjectCalendarEvent } from '@/lib/google-calendar';
import { format } from 'date-fns';

// Shadcn UI
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

// Icons
import {
    ArrowLeft, Briefcase, CalendarIcon, CheckCircle, Cloud, FileText,
    Image as ImageIcon, File as FileIcon, Info, Loader2,
    Upload, X, Play, Pause, RotateCcw, CheckSquare, ArrowRightLeft,
    IndianRupee, Gift
} from 'lucide-react';
import Link from 'next/link';
import { DesignerStatusPills } from '@/components/shared/DesignerStatusPills';
import ClientSelect from '@/components/shared/ClientSelect';
import { normalizeProductCategory } from '@/lib/product-category';


export default function NewProjectPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const { profile } = useAuth();
    const { designers } = useDesigners();
    const { categories: productCategories, createCategory } = useProductCategories();
    const [creating, setCreating] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    // Billable / Non-billable confirmation popup (asked at the end of entry)
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [billingChoice, setBillingChoice] = useState<'billable' | 'non_billable'>('billable');

    // Status update for existing job (when opened via ?job_id=xxx)
    const searchParams = useSearchParams();
    const taskId = searchParams?.get('task_id');   // keep for backward compat
    const jobId  = searchParams?.get('job_id') || taskId;  // prefer job_id
    const [currentStatus, setCurrentStatus] = useState<string>('');
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [showTransferPanel, setShowTransferPanel] = useState(false);
    const [transferToId, setTransferToId] = useState<string>('');

    const STATUS_ACTIONS = [
        { status: 'live',   label: 'Live',   icon: Play,        color: 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' },
        { status: 'hold',   label: 'Hold',   icon: Pause,       color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200' },
        { status: 'review', label: 'Review', icon: CheckSquare, color: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200' },
        { status: 'end',    label: 'End',    icon: RotateCcw,   color: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200' },
    ];

    const handleStatusChange = async (newStatus: string, extraPayload?: Record<string, any>) => {
        if (!jobId || statusUpdating) return;
        setStatusUpdating(true);
        try {
            const res = await fetch(`/api/jobs/${jobId}/designer-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designer_status: newStatus, ...extraPayload }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Status update failed');
            setCurrentStatus(newStatus);
            toast.success(`Status set to ${newStatus.toUpperCase()}`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferToId) { toast.error('Please select a designer to transfer to'); return; }
        const chosen = designers?.find((d: any) => d.id === transferToId);
        await handleStatusChange('transfer', { designer_id: transferToId });
        toast.success(`Transferred to ${chosen?.name || 'designer'}`);
        setShowTransferPanel(false);
        setTransferToId('');
    };

    // Load existing task status when task_id is present
    // Load existing job's designer_status when job_id is present
    useEffect(() => {
        if (!jobId) return;
        supabase.from('jobs').select('designer_status').eq('id', jobId).single()
            .then(({ data }) => { if (data?.designer_status) setCurrentStatus(data.designer_status); });
    }, [jobId]);

    // Form data
    const [formData, setFormData] = useState({
        title: '',
        clientId: '',
        brandId: '',       // UUID from brands table (if migration run)
        brandName: '',     // text name always stored for display
        designerId: '',
        // The master list in Settings holds three work types, and this form now
        // writes those exact names. It used to write 'Design' / 'Printing' /
        // 'Design + Printing' — a second vocabulary for the same three things,
        // which left 403 jobs invisible to every screen that tests job_type.
        jobType: 'Design Only',
        productCategory: '',
        deadline: undefined as Date | undefined,
        priority: 'normal',
        driveLink: '',
        description: '',
        files: [] as File[],
    });

    // Calendar popover state
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Drag & drop state
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drive verification state
    const [driveFileStatus, setDriveFileStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
    const [driveFileInfo, setDriveFileInfo] = useState<DriveFileInfo | null>(null);
    const [driveFileError, setDriveFileError] = useState<string>('');

    // Org-wide Drive token (from admin-connected Google Drive)
    const [orgDriveToken, setOrgDriveToken] = useState<string | null>(null);
    useEffect(() => {
        fetch('/api/drive/token')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.accessToken) setOrgDriveToken(data.accessToken); })
            .catch(() => { });
    }, []);

    // Pre-select current user as designer
    useEffect(() => {
        if (profile?.id && designers?.length > 0 && !formData.designerId) {
            const currentDesigner = designers.find((d: any) => d.id === profile.id || d.user_id === profile.id);
            if (currentDesigner) {
                setFormData(prev => ({ ...prev, designerId: currentDesigner.id }));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id, designers.length, formData.designerId]);

    // Fetch brands when client changes
    const [clientBrands, setClientBrands] = useState<{ id: string; name: string }[]>([]);
    const [addingBrand, setAddingBrand] = useState(false);
    const [newBrandInput, setNewBrandInput] = useState('');
    useEffect(() => {
        if (!formData.clientId) {
            setClientBrands([]);
            setFormData(prev => ({ ...prev, brandId: '', brandName: '' }));
            return;
        }
        fetch(`/api/clients/${formData.clientId}/brands`)
            .then(r => r.ok ? r.json() : { data: [] })
            .then(j => setClientBrands(j.data || []))
            .catch(() => setClientBrands([]));
    }, [formData.clientId]);

    const handleCreateBrand = async (nameOverride?: string) => {
        const name = (nameOverride ?? newBrandInput).trim();
        if (!name || !formData.clientId) return;
        try {
            const res = await fetch(`/api/clients/${formData.clientId}/brands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to add brand');
            const newBrand = json.data;
            if (newBrand) {
                setClientBrands(prev => {
                    const filtered = prev.filter(b => b.id !== newBrand.id);
                    return [...filtered, newBrand].sort((a, b) => a.name.localeCompare(b.name));
                });
                setFormData(prev => ({ ...prev, brandId: newBrand.id, brandName: newBrand.name }));
                toast.success(`Brand "${newBrand.name}" added!`);
            }
        } catch (err: any) {
            toast.error(err.message || 'Could not add brand');
        }
        setNewBrandInput('');
        setAddingBrand(false);
    };

    // Handle Drive link change with verification
    const handleDriveLinkChange = async (link: string) => {
        setFormData(prev => ({ ...prev, driveLink: link }));

        if (!link.trim()) {
            setDriveFileStatus('idle');
            setDriveFileInfo(null);
            setDriveFileError('');
            return;
        }

        const fileId = extractFileIdFromLink(link);
        if (!fileId) {
            setDriveFileStatus('error');
            setDriveFileError('Invalid Google Drive link format');
            return;
        }

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
        setFormData(prev => ({ ...prev, files: [...prev.files, ...fileArray] }));
    }, []);

    const removeFile = useCallback((index: number) => {
        setFormData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
    }, []);

    // Drag & drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    }, [addFiles]);

    const getUploadFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) return <ImageIcon size={16} className="text-muted-foreground" />;
        if (file.type === 'application/pdf') return <FileText size={16} className="text-muted-foreground" />;
        return <FileIcon size={16} className="text-muted-foreground" />;
    };

    // Step 1: on Create, run native validation then ask billable/non-billable.
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Smart default: Print-only jobs have no design work → non-billable.
        const isPrintOnly = formData.jobType === 'Print Only';
        setBillingChoice(isPrintOnly ? 'non_billable' : 'billable');
        setShowBillingModal(true);
    };

    // Step 2: create the project with the chosen billing tag.
    const doCreate = async (billing: 'billable' | 'non_billable') => {
        setShowBillingModal(false);
        setCreating(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const isDesignerRole = profile?.role === 'designer';

            // Generate job number (same logic as useJobs.createJob)
            const typeCode = getProjectTypeCode(formData.jobType);
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            let jobNumber = `${typeCode}-${dd}${mm}001`;
            try {
                const { data: numberData } = await supabase.rpc('get_next_number', { counter_id: 'job', type_prefix: typeCode });
                if (numberData) jobNumber = numberData;
            } catch (e) {
                console.warn('RPC get_next_number failed, using fallback');
            }

            const jobData: any = {
                job_number: jobNumber,
                project_name: formData.title,
                client_id: formData.clientId,
                designer_id: formData.designerId || user?.id,
                job_type: formData.jobType,
                brand_id: formData.brandId || null,     // UUID FK to brands table
                brand_name: formData.brandName || null,  // text copy for fast display
                product_category: normalizeProductCategory(formData.productCategory),
                client_deadline: formData.deadline ? formData.deadline.toISOString().split('T')[0] : null,
                priority: formData.priority,
                drive_link: formData.driveLink || null,
                description: formData.description || null,
                parent_job_id: null,
                project_origin: isDesignerRole ? 'designer' : 'admin',

                // Finance tag chosen in the popup. Admin's choice is authoritative;
                // a designer's is a suggestion that admin confirms during approval.
                design_billing: billing,
                design_billing_confirmed: !isDesignerRole,

                // Designer-created projects start in awaiting_admin
                current_stage: isDesignerRole ? 'awaiting_admin' : 'new',
                status: 'active',

                // Financial fields (zeroed out — admin sets these)
                quantity: 1,
                quote_per_piece: 0,
                subtotal: 0,
                gst_rate: 0,
                gst_amount: 0,
                discount_amount: 0,
                total_amount: 0,
                payment_status: 'pending',
                amount_received: 0,
                order_date: new Date().toISOString().split('T')[0],
                created_by: user?.id,
            };

            const { data: newJob, error } = await supabase
                .from('jobs')
                .insert([jobData])
                .select()
                .single();

            if (error) throw error;

            // Upload files to Google Drive
            if (formData.files.length > 0 && (orgDriveToken || session?.accessToken)) {
                const driveToken = (orgDriveToken || session!.accessToken) as string;

                // Create project folder: Aayam Projects > AAY-XXXX - Project Name
                setUploadProgress('Creating project folder...');
                const { folderId: projectFolderId } = await getProjectFolder(
                    driveToken, jobNumber, formData.title
                );

                // Each uploaded file becomes an entry in jobs.files[] — the single
                // source of truth that Project Assets, counts, and the job page read.
                const uploadedFiles: { name: string; url: string; storage: string; type: string; size: number; uploaded_at: string }[] = [];
                for (let i = 0; i < formData.files.length; i++) {
                    const file = formData.files[i];
                    setUploadProgress(`Uploading ${i + 1}/${formData.files.length}: ${file.name}`);

                    const result = await uploadToDrive(
                        driveToken, file, projectFolderId || undefined, undefined,
                        { uploadedTo: `Design Project: ${formData.title}`, resourceId: newJob.id }
                    );

                    if (result.success && result.webViewLink) {
                        uploadedFiles.push({
                            name: file.name,
                            url: result.webViewLink,
                            storage: 'drive',
                            type: file.type,
                            size: file.size,
                            uploaded_at: new Date().toISOString(),
                        });
                    }
                }

                if (uploadedFiles.length > 0) {
                    // Files go into files[]; drive_link holds ONLY the project folder link
                    // (plus any link the user typed), never the individual file links.
                    const folderLink = projectFolderId ? `https://drive.google.com/drive/folders/${projectFolderId}` : '';
                    const driveLinkValue = [formData.driveLink, folderLink].filter(Boolean).join('\n') || null;
                    await supabase
                        .from('jobs')
                        .update({ files: uploadedFiles, drive_link: driveLinkValue })
                        .eq('id', newJob.id);
                }
                setUploadProgress('');
            }

            // Create Calendar event
            if ((orgDriveToken || session?.accessToken) && formData.deadline) {
                const calendarEvent = createProjectCalendarEvent(
                    formData.title,
                    formData.deadline.toISOString().split('T')[0],
                    formData.description,
                    formData.driveLink
                );

                const eventResult = await createCalendarEvent((orgDriveToken || session!.accessToken) as string, calendarEvent);

                if (eventResult.success && eventResult.eventId) {
                    await supabase
                        .from('jobs')
                        .update({
                            calendar_event_id: eventResult.eventId,
                            calendar_event_link: eventResult.eventLink,
                        })
                        .eq('id', newJob.id);
                }
            }

            // Notify admins if designer-created
            if (isDesignerRole) {
                const assignedDesigner = designers?.find((d: any) => d.id === formData.designerId);
                const assignedName = assignedDesigner?.name || profile?.full_name || 'Designer';
                const creatorName = profile?.full_name || 'Designer';
                const isDelegated = assignedDesigner && assignedDesigner.id !== profile?.id;

                // Notify admin
                const adminMessage = `🆕 New project "${formData.title}" submitted by ${creatorName}${isDelegated ? `, delegated to ${assignedName}` : ''
                    }. Pricing & approval needed.`;

                try {
                    await supabase.from('broadcast_notifications').insert({
                        message: adminMessage,
                        priority: 'normal',
                        target_audience: 'admin',
                    });
                } catch { }

                // Notify the assigned designer if delegated to someone else
                if (isDelegated && assignedDesigner?.user_id) {
                    try {
                        await supabase.from('broadcast_notifications').insert({
                            message: `📋 ${creatorName} has delegated "${formData.title}" to you. Awaiting admin approval before work begins.`,
                            priority: 'normal',
                            target_audience: 'specific',
                            target_user_id: assignedDesigner.user_id,
                        });
                    } catch { }
                }
            }

            toast.error(String(isDesignerRole
                ? 'Project submitted! Admin will be notified to set pricing and approve.'
                : 'Project created successfully!'
            ));
            router.push('/admin/designers/my-queue');
        } catch (error: any) {
            console.error('Error creating project:', error);
            toast.error(String('Failed to create project: ' + error.message));
        } finally {
            setCreating(false);
            setUploadProgress('');
        }
    };

    const isDesignerRole = profile?.role === 'designer';

    return (
        <div className="space-y-4 max-w-3xl">
            {/* Simple Header */}
            <div>
                <div>
                    <Link
                        href="/admin/designers/my-queue"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to Queue
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-md">
                            <Briefcase size={22} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">Create New Project</h1>
                            <p className="text-sm text-muted-foreground">Quick-start a design or print job</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Action Bar — shown when editing an existing job */}
            {jobId ? (
              <div className="bg-card border rounded-xl px-5 py-4">
                <DesignerStatusPills
                  jobId={jobId}
                  currentStatus={currentStatus}
                  onStatusChange={setCurrentStatus}
                  designers={(designers || []).map((d: any) => ({ id: d.id, full_name: d.name || d.full_name || d.email }))}
                  size="bar"
                />
              </div>
            ) : (
              <div className="bg-card border rounded-xl px-5 py-4">
                {/* New project — no jobId yet, just show a preview of the status pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground mr-1">Task Status:</span>
                  <DesignerStatusPills
                    jobId="__preview__"
                    currentStatus={currentStatus || 'live'}
                    disabled={true}
                    size="bar"
                  />
                </div>
              </div>
            )}

            {/* Form */}
            <div>
                <form onSubmit={handleSubmit} className="space-y-6">


                    {/* Project Info */}
                    <div className="bg-card border rounded-md p-5 space-y-4">
                        {/* Project Name */}
                        <div className="space-y-2">
                            <Label htmlFor="projectName" className="text-sm font-semibold">
                                Project Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="projectName"
                                required
                                placeholder="e.g. Wedding Invitation - Sharma Family"
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </div>

                        {/* Client + Designer row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    Client <span className="text-destructive">*</span>
                                </Label>
                                <ClientSelect
                                    required
                                    value={formData.clientId}
                                    onChange={(val) => setFormData(prev => ({ ...prev, clientId: val }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Assign to</Label>
                                <Select
                                    value={formData.designerId}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, designerId: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Designer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                            // Find current user in designers list
                                            const me = designers?.find((d: any) =>
                                                d.id === profile?.id || d.user_id === profile?.id
                                            );
                                            // Other designers (excluding current user, must have a real name)
                                            const others = designers?.filter((d: any) => {
                                                const n = d.name || '';
                                                return d.id !== (me?.id) &&
                                                    d.user_id !== profile?.id &&
                                                    n.trim() !== '' &&
                                                    !/^Designer\s*\d+$/i.test(n.trim()); // hide Designer 5/6/7/8 placeholder accounts
                                            }) || [];

                                            return (
                                                <>
                                                    {/* Current user first — use their actual name */}
                                                    {me ? (
                                                        <SelectItem value={me.id}>{me.name}</SelectItem>
                                                    ) : profile?.full_name ? (
                                                        // Fallback: user exists in profiles but not in designers table
                                                        <SelectItem value={profile.id}>{profile.full_name}</SelectItem>
                                                    ) : null}
                                                    {/* All other designers */}
                                                    {others.map((d: any) => (
                                                        <SelectItem key={d.id} value={d.id}>
                                                            {d.name}
                                                        </SelectItem>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </SelectContent>
                                </Select>
                                {/* Show delegation note if someone else is selected */}
                                {formData.designerId && formData.designerId !== profile?.id && (() => {
                                    const meId = designers?.find((d: any) => d.id === profile?.id || d.user_id === profile?.id)?.id;
                                    if (meId && formData.designerId === meId) return null;
                                    const assignedName = designers?.find((d: any) => d.id === formData.designerId)?.name;
                                    if (!assignedName) return null;
                                    return (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1.5 rounded-md">
                                             📤 Delegating to <strong>{assignedName}</strong> — both you and {assignedName} will be notified on admin approval.
                                         </p>
                                     );
                                 })()}
                             </div>
                         </div>

                        {/* Brand field — always visible */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">
                                Brand <span className="text-xs text-muted-foreground">(optional)</span>
                            </Label>
                            {!formData.clientId ? (
                                <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                                    Select a client first to see brand options
                                </p>
                            ) : addingBrand ? (
                                /* Inline new brand input */
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newBrandInput}
                                        onChange={e => setNewBrandInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateBrand(); } if (e.key === 'Escape') { setAddingBrand(false); setNewBrandInput(''); } }}
                                        placeholder="Type new brand name..."
                                        className="flex-1 px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    />
                                    <button type="button" onClick={() => handleCreateBrand()}
                                        className="px-3 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90">
                                        Save
                                    </button>
                                    <button type="button" onClick={() => { setAddingBrand(false); setNewBrandInput(''); }}
                                        className="px-3 py-2 border rounded-md text-sm hover:bg-muted">
                                        Cancel
                                    </button>
                                </div>
                            ) : clientBrands.length === 0 ? (
                                /* No brands yet — free text input + option to save as brand */
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.brandName}
                                        onChange={e => setFormData(prev => ({ ...prev, brandName: e.target.value, brandId: '' }))}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateBrand(formData.brandName); } }}
                                        placeholder="+ Type brand name"
                                        className="flex-1 px-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    />
                                    {formData.brandName && (
                                        <button type="button" onClick={() => handleCreateBrand(formData.brandName)}
                                            className="px-3 py-2 text-xs border rounded-md hover:bg-muted text-muted-foreground">
                                            Save brand
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* Has brands — show dropdown with real UUIDs */
                                <Select
                                    value={formData.brandId}
                                    onValueChange={(val) => {
                                        if (val === '__add_new') {
                                            setAddingBrand(true);
                                        } else {
                                            const chosen = clientBrands.find(b => b.id === val);
                                            setFormData(prev => ({ ...prev, brandId: val, brandName: chosen?.name || val }));
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select brand..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clientBrands.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                        <SelectItem value="__add_new" className="text-primary font-medium border-t mt-1 pt-1">
                                            + Add New Brand
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            {/* Show selected brand name as confirmation */}
                            {formData.brandName && !addingBrand && (
                                <p className="text-xs text-muted-foreground">
                                    Selected: <span className="font-semibold text-foreground">{formData.brandName}</span>
                                </p>
                            )}
                        </div>

                    </div>

                    <Separator />

                    {/* Parameters */}
                    <div className="bg-card border rounded-md p-5 space-y-5">
                        {/* Job Type */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Job Type</Label>
                            <ToggleGroup
                                type="single"
                                value={formData.jobType}
                                onValueChange={(val) => { if (val) setFormData(prev => ({ ...prev, jobType: val })); }}
                                className="justify-start"
                            >
                                <ToggleGroupItem value="Design Only" className="gap-1.5 px-4 data-[state=on]:bg-violet-100 data-[state=on]:text-violet-700 data-[state=on]:border-violet-300">
                                    Design Only
                                </ToggleGroupItem>
                                <ToggleGroupItem value="Print Only" className="gap-1.5 px-4 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700 data-[state=on]:border-emerald-300">
                                    Print Only
                                </ToggleGroupItem>
                                <ToggleGroupItem value="Design + Print" className="gap-1.5 px-4 data-[state=on]:bg-sky-100 data-[state=on]:text-sky-700 data-[state=on]:border-sky-300">
                                    Design + Print
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        {/* Product Category */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Product Category</Label>
                            {formData.productCategory === '__add_new__' ? (
                                <div className="flex gap-2">
                                    <Input
                                        autoFocus
                                        placeholder="Type new category name..."
                                        id="newCategoryInput"
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = (e.target as HTMLInputElement).value.trim();
                                                if (val) {
                                                    const { data: newCat } = await createCategory(val);
                                                    if (newCat) setFormData(prev => ({ ...prev, productCategory: newCat.name }));
                                                    else setFormData(prev => ({ ...prev, productCategory: '' }));
                                                }
                                            }
                                            if (e.key === 'Escape') setFormData(prev => ({ ...prev, productCategory: '' }));
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={async () => {
                                            const input = document.getElementById('newCategoryInput') as HTMLInputElement;
                                            const val = input?.value?.trim();
                                            if (val) {
                                                const { data: newCat } = await createCategory(val);
                                                if (newCat) setFormData(prev => ({ ...prev, productCategory: newCat.name }));
                                                else setFormData(prev => ({ ...prev, productCategory: '' }));
                                            }
                                        }}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFormData(prev => ({ ...prev, productCategory: '' }))}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Select
                                    value={formData.productCategory}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, productCategory: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {productCategories?.map((cat: any) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="__add_new__" className="text-primary font-medium border-t mt-1 pt-1">
                                            + Add New Category
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Deadline + Priority row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Deadline Calendar */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Deadline</Label>
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`w-full justify-start text-left font-normal ${!formData.deadline ? 'text-muted-foreground' : ''}`}
                                        >
                                            <CalendarIcon size={16} className="mr-2" />
                                            {formData.deadline ? format(formData.deadline, 'PPP') : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={formData.deadline}
                                            onSelect={(date) => {
                                                setFormData(prev => ({ ...prev, deadline: date || undefined }));
                                                setCalendarOpen(false);
                                            }}
                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Priority */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Priority</Label>
                                <ToggleGroup
                                    type="single"
                                    value={formData.priority}
                                    onValueChange={(val) => { if (val) setFormData(prev => ({ ...prev, priority: val })); }}
                                    className="justify-start w-full"
                                >
                                    <ToggleGroupItem value="normal" className="flex-1 data-[state=on]:bg-gray-100 data-[state=on]:text-gray-700">
                                        Normal
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="high" className="flex-1 data-[state=on]:bg-orange-100 data-[state=on]:text-orange-700 data-[state=on]:border-orange-300">
                                        High
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="urgent" className="flex-1 data-[state=on]:bg-red-100 data-[state=on]:text-red-700 data-[state=on]:border-red-300">
                                        Urgent
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Assets & Brief */}
                    <div className="bg-card border rounded-md p-5 space-y-5">
                        {/* Drive Link */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Cloud size={14} />
                                Google Drive Link
                            </Label>
                            <Input
                                type="url"
                                placeholder="https://drive.google.com/drive/folders/..."
                                value={formData.driveLink}
                                onChange={e => handleDriveLinkChange(e.target.value)}
                            />

                            {/* Drive Verification Status */}
                            {driveFileStatus === 'verifying' && (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Loader2 size={14} className="animate-spin" /> Verifying file...
                                </div>
                            )}
                            {driveFileStatus === 'verified' && driveFileInfo && (
                                <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-3">
                                    <CheckCircle size={16} className="text-green-600 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-green-900 truncate">{driveFileInfo.name}</p>
                                        <p className="text-xs text-green-700">{formatBytes(driveFileInfo.size)} — Verified</p>
                                    </div>
                                </div>
                            )}
                            {driveFileStatus === 'error' && driveFileError && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-start gap-2">
                                    <X size={16} className="text-destructive shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-destructive">{driveFileError}</p>
                                        <p className="text-xs text-destructive/80 mt-0.5">Make sure the file is shared with &ldquo;Anyone with the link&rdquo;</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Upload size={14} />
                                Upload Assets to Google Drive
                            </Label>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-all ${isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted hover:border-muted-foreground/30 hover:bg-muted/30'
                                    }`}
                            >
                                <Upload size={28} className="mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-foreground">
                                    {isDragging ? 'Drop files here' : 'Drag & drop files, or click to browse'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Images, PDFs, documents — any file type</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={e => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            addFiles(e.target.files);
                                            e.target.value = '';
                                        }
                                    }}
                                    className="hidden"
                                />
                            </div>

                            {/* File List */}
                            {formData.files.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        {formData.files.length} file{formData.files.length !== 1 ? 's' : ''} selected
                                    </p>
                                    {formData.files.map((file, index) => (
                                        <div
                                            key={`${file.name}-${index}`}
                                            className="flex items-center gap-3 bg-muted/50 rounded-md px-3 py-2 border"
                                        >
                                            {getUploadFileIcon(file)}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatBytes(String(file.size))}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                                className="p-1 hover:bg-muted rounded transition-colors"
                                            >
                                                <X size={14} className="text-muted-foreground" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Warning if not signed in */}
                            {!orgDriveToken && !session?.accessToken && formData.files.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                                    <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800">
                                        Connect Google Drive to upload files. Without connection, files won&apos;t be uploaded.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <FileText size={14} />
                                Notes / Brief
                            </Label>
                            <Textarea
                                rows={4}
                                placeholder="Describe specific requirements, items to print, size, quantity, special instructions..."
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Info Banner for Designers */}
                    {isDesignerRole && (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
                            <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-900">Admin Approval Required</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    This project will be sent to admin for pricing and approval. You can start work only after admin confirms.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 items-center justify-end bg-card rounded-md p-4 border sticky bottom-4">
                        {uploadProgress && (
                            <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 size={14} className="animate-spin" />
                                <span>{uploadProgress}</span>
                            </div>
                        )}
                        <Link href="/admin/designers/my-queue">
                            <Button type="button" variant="outline">Cancel</Button>
                        </Link>
                        <Button type="submit" disabled={creating}>
                            {creating ? (
                                <><Loader2 size={16} className="animate-spin" /> Creating...</>
                            ) : (
                                <><CheckCircle size={16} /> {isDesignerRole ? 'Submit for Approval' : 'Create Project'}</>
                            )}
                        </Button>
                    </div>

                </form>
            </div>

            {/* Billable / Non-billable confirmation popup */}
            {showBillingModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => !creating && setShowBillingModal(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Is the design work billable?</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Choose whether this project&apos;s design is charged to the client.
                                {formData.jobType === 'Print Only' && ' (Print-only jobs are usually non-billable.)'}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                disabled={creating}
                                onClick={() => { setBillingChoice('billable'); doCreate('billable'); }}
                                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 transition disabled:opacity-60
                                    ${billingChoice === 'billable' ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'}`}
                            >
                                <IndianRupee size={22} className="text-green-600" />
                                <span className="text-sm font-bold text-green-700">BILLABLE</span>
                                <span className="text-[11px] text-muted-foreground text-center">Design is charged — full effort, revisions OK</span>
                            </button>

                            <button
                                type="button"
                                disabled={creating}
                                onClick={() => { setBillingChoice('non_billable'); doCreate('non_billable'); }}
                                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-4 transition disabled:opacity-60
                                    ${billingChoice === 'non_billable' ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'}`}
                            >
                                <Gift size={22} className="text-amber-600" />
                                <span className="text-sm font-bold text-amber-700">NON-BILLABLE</span>
                                <span className="text-[11px] text-muted-foreground text-center">Free design — keep it fast, minimal revisions</span>
                            </button>
                        </div>

                        {isDesignerRole && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                This is a suggestion — the admin will confirm the billing when they approve pricing.
                            </p>
                        )}

                        {creating && (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 size={16} className="animate-spin" /> Creating project…
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={creating}
                            onClick={() => setShowBillingModal(false)}
                            className="w-full text-sm text-muted-foreground hover:text-foreground py-1"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
