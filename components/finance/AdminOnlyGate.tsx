'use client';

/** Shows its children only to an admin login. Used by the Trial screens. */

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminOnlyGate({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<'checking' | 'admin' | 'denied'>('checking');

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setState('denied'); return; }
            const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
            setState(p?.role === 'admin' ? 'admin' : 'denied');
        })();
    }, []);

    if (state === 'checking') return <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>;
    if (state === 'denied') {
        return (
            <div className="p-6 max-w-md mx-auto text-center text-sm text-muted-foreground">
                <Lock className="mx-auto mb-2" size={22} />
                <p className="font-semibold text-foreground">Admin only</p>
                <p>This trial screen is open to the admin login only.</p>
            </div>
        );
    }
    return <>{children}</>;
}
