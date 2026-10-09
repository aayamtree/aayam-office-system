'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface PageSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** e.g. "Showing 3 of 79" — only displayed while something is typed */
  resultText?: string;
  className?: string;
}

/**
 * Search box for filtering what is on the CURRENT page (⌘K stays the
 * search-everything tool). Press "/" to jump into it, Esc to clear.
 */
export default function PageSearch({ value, onChange, placeholder = 'Search this page…', resultText, className = '' }: PageSearchProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { onChange(''); (e.target as HTMLInputElement).blur(); } }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); ref.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {value && resultText && <span className="text-xs text-muted-foreground whitespace-nowrap">{resultText}</span>}
    </div>
  );
}
