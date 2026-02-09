'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Machine, SheetSize, Material } from '@/types/database';

// Quick Add Machine Modal
export function QuickAddMachine({
    onClose,
    onAdded
}: {
    onClose: () => void;
    onAdded: (machine: Machine) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('machines')
                .insert([{ name: name.trim(), is_active: true }])
                .select()
                .single();

            if (insertError) throw insertError;
            onAdded(data);
        } catch (err: any) {
            setError(err.message || 'Failed to add machine');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-md w-full max-w-md  p-6">
                <h4 className="text-section text-gray-900 mb-4">Add New Machine</h4>

                {error && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-700 mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Machine Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-200 rounded-md px-4 py-2 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all outline-none"
                            placeholder="e.g., Offset Printer, Digital Press"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="px-4 py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Adding...' : 'Add Machine'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Quick Add Sheet Size Modal
export function QuickAddSheetSize({
    onClose,
    onAdded
}: {
    onClose: () => void;
    onAdded: (size: SheetSize) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [size, setSize] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!size.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('sheet_sizes')
                .insert([{ size: size.trim(), is_active: true }])
                .select()
                .single();

            if (insertError) throw insertError;
            onAdded(data);
        } catch (err: any) {
            setError(err.message || 'Failed to add sheet size');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-md w-full max-w-md  p-6">
                <h4 className="text-section text-gray-900 mb-4">Add New Sheet Size</h4>

                {error && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-700 mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Sheet Size
                        </label>
                        <input
                            type="text"
                            required
                            value={size}
                            onChange={(e) => setSize(e.target.value)}
                            className="w-full border border-gray-200 rounded-md px-4 py-2 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all outline-none"
                            placeholder="e.g., 18x24, 20x30, Custom"
                            autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-2">Enter size in inches (e.g., 18x24) or descriptive name</p>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !size.trim()}
                            className="px-4 py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Adding...' : 'Add Size'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Quick Add Material Modal
export function QuickAddMaterial({
    onClose,
    onAdded
}: {
    onClose: () => void;
    onAdded: (material: Material) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('materials')
                .insert([{ name: name.trim(), is_active: true }])
                .select()
                .single();

            if (insertError) throw insertError;
            onAdded(data);
        } catch (err: any) {
            setError(err.message || 'Failed to add material');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-md w-full max-w-md  p-6">
                <h4 className="text-section text-gray-900 mb-4">Add New Material</h4>

                {error && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-700 mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Material Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border border-gray-200 rounded-md px-4 py-2 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all outline-none"
                            placeholder="e.g., Vinyl, Paper, Canvas, Sticker"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="px-4 py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Adding...' : 'Add Material'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
