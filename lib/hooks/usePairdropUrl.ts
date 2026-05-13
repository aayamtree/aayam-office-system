import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function usePairdropUrl() {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'pairdrop_url')
            .maybeSingle()
            .then(({ data }) => {
                setUrl(data?.value || null);
                setLoading(false);
            });
    }, []);

    return { url, loading };
}
