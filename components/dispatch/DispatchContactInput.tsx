'use client';

// ─────────────────────────────────────────────────────────────
// Type a courier or driver, or pick one used before.
//
// The old Transporter field was a <select> when any transport vendor
// existed and a text box when none did — so adding the first vendor
// would have quietly removed dispatch's ability to enter a name that
// wasn't on the list. This is always both: type freely, and what you
// have used before drops down underneath, most-used first.
//
// Nothing has to be set up in advance. The database remembers each
// name the first time a dispatch goes out with it (see the trigger in
// dispatch_contacts_remember_couriers_and_drivers).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Clock, ChevronDown } from 'lucide-react';
import { toast } from '@/lib/toast';

export type ContactKind = 'courier' | 'transport' | 'local_driver';

export interface DispatchContact {
  id: string;
  kind: ContactKind;
  name: string;
  phone: string | null;
  times_used: number;
  last_used_at: string | null;
}

// One fetch per kind, shared across mounts — the modal remounts every time
// it opens and the list changes at most once per dispatch.
const cache: Partial<Record<ContactKind, { at: number; rows: DispatchContact[] }>> = {};
const CACHE_MS = 60_000;

export function invalidateContactCache(kind?: ContactKind) {
  if (kind) delete cache[kind];
  else (Object.keys(cache) as ContactKind[]).forEach(k => delete cache[k]);
}

async function loadContacts(kind: ContactKind): Promise<DispatchContact[]> {
  const hit = cache[kind];
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;

  const { data, error } = await supabase
    .from('dispatch_contacts')
    .select('id, kind, name, phone, times_used, last_used_at')
    .eq('kind', kind)
    .eq('is_active', true)
    // Most-used first: the two or three names used every week end up on top
    // without anyone maintaining a favourites list.
    .order('times_used', { ascending: false })
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(50);

  // A failed lookup must not block a dispatch. Typing still works.
  if (error) {
    console.error('[dispatch-contacts] could not load saved names:', error.message);
    return [];
  }
  const rows = (data || []) as DispatchContact[];
  cache[kind] = { at: Date.now(), rows };
  return rows;
}

interface Props {
  kind: ContactKind;
  value: string;
  onChange: (name: string) => void;
  /** Called when a SAVED contact is picked, so the caller can fill the phone. */
  onPick?: (contact: DispatchContact) => void;
  placeholder?: string;
  id?: string;
}

export default function DispatchContactInput({ kind, value, onChange, onPick, placeholder, id }: Props) {
  const [contacts, setContacts] = useState<DispatchContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadContacts(kind).then(rows => {
      if (!alive) return;
      setContacts(rows);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [kind]);

  // Close when the user clicks elsewhere — on a phone this is how the list
  // gets out of the way.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const query = value.trim().toLowerCase();
  const matches = query
    ? contacts.filter(c => c.name.toLowerCase().includes(query))
    : contacts;
  const [adding, setAdding] = useState(false);
  const exact = contacts.some(c => c.name.trim().toLowerCase() === query);

  const pick = useCallback((c: DispatchContact) => {
    onChange(c.name);
    onPick?.(c);
    setOpen(false);
  }, [onChange, onPick]);

  // Add the typed name to the saved list right now. (It is also saved
  // automatically when the dispatch goes out; this just doesn't make you wait.)
  const addNow = async () => {
    const name = value.trim();
    if (!name) return;
    setAdding(true);
    const { error } = await supabase
      .from('dispatch_contacts')
      .insert({ kind, name, times_used: 0, is_active: true });
    setAdding(false);
    if (error) {
      toast.error(error.code === '42501'
        ? 'Only an admin can add names to the list now — but it will be saved automatically when you dispatch.'
        : 'Could not add: ' + error.message);
      return;
    }
    invalidateContactCache(kind);
    setContacts(await loadContacts(kind));
    toast.success(`${name} added to the list ✓`);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && matches[highlight]) { e.preventDefault(); pick(matches[highlight]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full px-3 py-2 pr-8 border rounded-md text-sm"
        />
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-gray-300 absolute right-2.5 top-1/2 -translate-y-1/2" />
          : contacts.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-label="Show saved names"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
      </div>

      {open && (matches.length > 0 || (!!value.trim() && !exact)) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          {matches.length > 0 && (
            <ul className="max-h-56 overflow-y-auto">
              {matches.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    // mousedown, not click: the input's blur would close the
                    // list before a click ever landed.
                    onMouseDown={e => { e.preventDefault(); pick(c); }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                      i === highlight ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{c.name}</span>
                      {c.phone && <span className="block text-[11px] text-gray-500">{c.phone}</span>}
                    </span>
                    {c.times_used > 0 && (
                      <span className="shrink-0 text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.times_used}×
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Say plainly that a new name is kept, so nobody wonders whether
              they were meant to add it somewhere else first. */}
          {!!value.trim() && !exact && (
            <div className={`px-3 py-2 text-[11px] text-gray-500 ${matches.length ? 'border-t border-gray-100' : ''}`}>
              <strong className="text-gray-700">{value.trim()}</strong> is new. It is saved automatically when you dispatch.
              <button
                type="button"
                disabled={adding}
                onMouseDown={e => { e.preventDefault(); addNow(); }}
                className="mt-1.5 block w-full rounded-md bg-gray-900 px-2 py-1.5 text-center text-xs font-semibold text-white disabled:opacity-50"
              >
                {adding ? 'Adding…' : `Add "${value.trim()}" to the list now`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
