'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // DIRECT CLIENT
import {
    Plus, Phone, Edit, Trash2, Eye, X, Loader2, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// Raw Types to avoid any heavy type dependencies
type RawLead = {
    id: string;
    lead_number: string;
    name: string;
    phone: string;
    company: string;
    status: string;
    requirement: string;
    created_at: string;
};

export default function LeadsPageRaw() {
    const { user, profile } = useAuth();

    const [leads, setLeads] = useState<RawLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // RAW FETCH FUNCTION
    const fetchLeads = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Fetching leads raw...');

            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Fetch Error:', error);
                throw error;
            }

            console.log('Fetched Leads:', data);
            setLeads(data || []);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial Fetch
    useEffect(() => {
        fetchLeads();
    }, []);

    // --- ACTIONS ---

    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', status: 'new' });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const currentUserId = profile?.id || user?.id;
            if (!currentUserId) throw new Error('Not authenticated');

            // 1. Get Number directly
            const { data: numData } = await supabase.rpc('get_next_number', { counter_id: 'lead' });
            const leadNum = numData || `LD-${Date.now()}`;

            // 2. Insert directly
            const { error: insertError } = await supabase.from('leads').insert({
                name: formData.name,
                phone: formData.phone,
                status: formData.status,
                lead_number: leadNum,
                created_by: currentUserId,
                assigned_to: currentUserId
            });

            if (insertError) throw insertError;

            alert('Variable Saved!');
            setShowModal(false);
            fetchLeads(); // Reload list

        } catch (err: any) {
            alert('Save Failed: ' + err.message);
        }
    };

    // Clean UI
    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold">Leads (Direct Mode)</h1>
                    <p className="text-gray-500 text-sm">Diagnostic View</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchLeads} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><RefreshCw size={20} /></button>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">
                        <Plus size={20} /> Add Lead
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl font-mono text-sm border border-red-200">
                    Error: {error}
                </div>
            )}

            {loading ? (
                <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-indigo-600" size={32} /></div>
            ) : (
                <div className="grid gap-4">
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Total Leads: {leads.length}</div>

                    {leads.length === 0 && (
                        <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 text-yellow-700 text-center">
                            Database returned 0 leads.
                            <br />If you just saved one, please check Supabase Dashboard manually to see if the row exists.
                        </div>
                    )}

                    {leads.map(lead => (
                        <div key={lead.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs font-bold text-gray-600">{lead.lead_number}</span>
                                    <h3 className="font-bold text-lg">{lead.name}</h3>
                                </div>
                                <div className="text-gray-500">{lead.phone}</div>
                            </div>
                            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold text-xs uppercase">
                                {lead.status}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Simple Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
                        <h2 className="font-bold text-xl">New Lead (Direct)</h2>
                        <input className="w-full p-2 border rounded" placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <input className="w-full p-2 border rounded" placeholder="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        <div className="flex gap-2 pt-4">
                            <button onClick={() => setShowModal(false)} className="flex-1 p-2 bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleSave} className="flex-1 p-2 bg-indigo-600 text-white rounded font-bold">Save</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
