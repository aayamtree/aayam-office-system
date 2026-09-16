'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { X, Save, Lock } from 'lucide-react';

interface Props {
    runId: string;
    onClose: () => void;
    onSaved: () => void;
}

interface Option { id: string; name: string; category?: string | null }

/**
 * Edit the descriptive side of a print run: its title, instructions, specs and
 * (while still Planned) its printer.
 *
 * Status, the job list and every money field stay out of here on purpose —
 * those already have their own buttons, and the money ones have written vendor
 * payment records that a quiet edit would leave wrong.
 *
 * The save goes through fn_update_print_run_details, which re-checks the role
 * and the status in the database. Hiding the button is not a permission.
 */
export function EditPrintRunModal({ runId, onClose, onSaved }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [listsFailed, setListsFailed] = useState(false);

    // The parents pass a fresh arrow every render, and the auth context re-renders
    // them on every token refresh. With onClose in the effect's deps that reloads
    // the run mid-edit and quietly puts the old values back under the operator.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const [runNumber, setRunNumber] = useState('');
    const [status, setStatus] = useState('');

    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [deadline, setDeadline] = useState('');
    const [machineId, setMachineId] = useState('');
    const [materialId, setMaterialId] = useState('');
    const [vendorId, setVendorId] = useState('');
    const [sheetSize, setSheetSize] = useState('');
    const [pulling, setPulling] = useState('');

    const [machines, setMachines] = useState<Option[]>([]);
    const [materials, setMaterials] = useState<Option[]>([]);
    const [vendors, setVendors] = useState<Option[]>([]);

    const isPlanned = status === 'planned';

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const [runRes, machineRes, materialRes, vendorRes] = await Promise.all([
                    supabase
                        .from('print_runs')
                        .select('id, print_run_number, status, title, notes, deadline, machine_id, material_id, vendor_id, sheet_size_label, pulling_multiple')
                        .eq('id', runId)
                        .single(),
                    supabase.from('machines').select('id, name').order('name'),
                    supabase.from('materials').select('id, name').order('name'),
                    supabase.from('vendors').select('id, name, category').order('name'),
                ]);

                if (cancelled) return;
                if (runRes.error) throw runRes.error;

                // A dropdown that renders empty because its query failed is how an
                // operator saves NULL over a real machine, material or printer.
                if (machineRes.error || materialRes.error || vendorRes.error) {
                    console.error('Error loading print run dropdowns:',
                        machineRes.error || materialRes.error || vendorRes.error);
                    setListsFailed(true);
                }

                const run = runRes.data as any;
                setRunNumber(run.print_run_number || '');
                setStatus(run.status || '');
                setTitle(run.title || '');
                setNotes(run.notes || '');
                setDeadline(run.deadline || '');
                setMachineId(run.machine_id || '');
                setMaterialId(run.material_id || '');
                setVendorId(run.vendor_id || '');
                setSheetSize(run.sheet_size_label || '');
                setPulling(run.pulling_multiple != null ? String(run.pulling_multiple) : '');

                setMachines((machineRes.data as Option[]) || []);
                setMaterials((materialRes.data as Option[]) || []);
                setVendors((vendorRes.data as Option[]) || []);
            } catch (err: any) {
                console.error('Error loading print run for edit:', err);
                toast.error(err?.message || 'Could not open this print run for editing');
                onCloseRef.current();
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [runId]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Give the run a title so the board reads clearly');
            return;
        }

        // type="number" accepts "1e3" and "1.9"; parseInt would store 1 for both.
        let pullingValue: number | null = null;
        if (pulling !== '') {
            const parsed = Math.round(Number(pulling));
            if (!Number.isFinite(parsed) || parsed < 1) {
                toast.error('Pulling sheets must be 1 or more');
                return;
            }
            pullingValue = parsed;
        }

        setSaving(true);
        try {
            // rpc() resolves with { error } instead of throwing, so this must be
            // checked — a lapsed session here looks exactly like a success.
            const { error } = await supabase.rpc('fn_update_print_run_details', {
                p_run_id: runId,
                p_title: title.trim(),
                p_notes: notes.trim() || null,
                p_deadline: deadline || null,
                p_machine_id: machineId || null,
                p_material_id: materialId || null,
                p_sheet_size_label: sheetSize.trim() || null,
                p_pulling_multiple: pullingValue,
                p_vendor_id: vendorId || null,
            });

            if (error) throw error;

            toast.success(`${runNumber} updated`);
            onSaved();
            onClose();
        } catch (err: any) {
            console.error('Error saving print run:', err);
            // The modal stays open on a failure, or the operator loses what they typed.
            toast.error(err?.message || 'Could not save the changes');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
                    <div>
                        <h2 className="text-foreground font-bold text-base">Edit {runNumber || 'print run'}</h2>
                        <p className="text-xs text-muted-foreground">Title, instructions and specs</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : (
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Run Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Pro Job 02 Sept 20x30 Metallic Sticker 1100 St."
                                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">This is the heading shown on the print run card.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                placeholder="Special instructions for the printer..."
                                className="w-full px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Machine</label>
                                <select
                                    value={machineId}
                                    onChange={(e) => setMachineId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
                                >
                                    <option value="">Select...</option>
                                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Sheet Size</label>
                                <input
                                    type="text"
                                    value={sheetSize}
                                    onChange={(e) => setSheetSize(e.target.value)}
                                    placeholder="e.g. 20x30"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Material</label>
                                <select
                                    value={materialId}
                                    onChange={(e) => setMaterialId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
                                >
                                    <option value="">Select...</option>
                                    {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 md:gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Pulling Sheets</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={pulling}
                                    onChange={(e) => setPulling(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Deadline</label>
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                                    Printer {!isPlanned && <Lock size={11} className="text-gray-400" />}
                                </label>
                                <select
                                    value={vendorId}
                                    disabled={!isPlanned}
                                    onChange={(e) => setVendorId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-400 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                    <option value="">Select...</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}{v.category ? ` (${v.category})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {listsFailed && (
                            <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                                The machine, material and printer lists did not load, so saving is blocked — it would wipe those fields. Close this and try again.
                            </p>
                        )}

                        {!isPlanned && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                The sheet has already left Planned, so the printer is fixed — a vendor bill is coming against it.
                            </p>
                        )}

                        <p className="text-[11px] text-muted-foreground">
                            Printing charge, paper supply, the job list and the stage are not edited here — each has its own action.
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <button
                                onClick={onClose}
                                disabled={saving}
                                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || listsFailed}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-md hover:bg-gray-800 disabled:opacity-50"
                            >
                                <Save size={13} /> {saving ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
