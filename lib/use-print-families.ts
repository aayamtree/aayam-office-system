'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PrintFamilyMap } from '@/lib/product-category';

/**
 * The print families as set in Settings > Product Categories.
 * Until it loads (or if it fails) the built-in groups in lib/product-category
 * apply, so the Planner never stops working.
 */
export function usePrintFamilies(): PrintFamilyMap {
  const [map, setMap] = useState<PrintFamilyMap>({});
  useEffect(() => {
    let dead = false;
    supabase.from('product_categories').select('name, print_family').then(({ data, error }) => {
      if (dead || error || !data) return;
      const m: PrintFamilyMap = {};
      for (const r of data as any[]) {
        const key = String(r.name || '').trim().toLowerCase();
        if (key) m[key] = String(r.print_family || '').trim();
      }
      setMap(m);
    });
    return () => { dead = true; };
  }, []);
  return map;
}
