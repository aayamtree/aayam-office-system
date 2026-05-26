'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calculator, Clock, Trash2, Copy, Check, ChevronDown, ChevronUp, Tag } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  label: string;
  amount: number;
  slab: number;
  mode: 'add' | 'remove';
  base: number;
  cgst: number;
  sgst: number;
  total: number;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GST_SLABS = [0, 5, 12, 18, 28];
const HISTORY_KEY = 'aayam-gst-history-v1';
const MAX_HISTORY = 50;

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch { }
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Result Panel ─────────────────────────────────────────────────────────────
function ResultPanel({ base, cgst, sgst, total, mode, slab }: {
  base: number; cgst: number; sgst: number; total: number; mode: 'add' | 'remove'; slab: number;
}) {
  const [copied, setCopied] = useState(false);
  const copyTotal = () => {
    navigator.clipboard.writeText(total.toFixed(2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-muted/50 border border-border/60 p-4 space-y-2.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Base amount</span>
        <span className="font-medium">{formatINR(base)}</span>
      </div>
      {slab > 0 && (
        <>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">CGST ({slab / 2}%)</span>
            <span>{formatINR(cgst)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">SGST ({slab / 2}%)</span>
            <span>{formatINR(sgst)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total GST ({slab}%)</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">{formatINR(cgst + sgst)}</span>
          </div>
        </>
      )}
      <div className="border-t border-border/60 pt-2.5 flex justify-between items-center">
        <span className="font-semibold text-sm">{mode === 'add' ? 'Total (with GST)' : 'Base (ex-GST)'}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-green-600 dark:text-green-400">{formatINR(total)}</span>
          <button
            onClick={copyTotal}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Copy total"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Item ─────────────────────────────────────────────────────────────
function HistoryItem({ entry, onDelete, onRestore }: {
  entry: HistoryEntry;
  onDelete: (id: string) => void;
  onRestore: (entry: HistoryEntry) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer group"
      onClick={() => onRestore(entry)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {entry.label && (
            <span className="text-xs font-medium text-foreground truncate">{entry.label}</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${entry.mode === 'add'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
            }`}>
            {entry.mode === 'add' ? '+' : '−'}{entry.slab}% GST
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{formatINR(entry.amount)}</span>
          <span>→</span>
          <span className="font-medium text-foreground">{formatINR(entry.total)}</span>
          <span className="ml-auto">{timeAgo(entry.timestamp)}</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main GSTCalculator ───────────────────────────────────────────────────────
interface GSTCalculatorProps {
  compact?: boolean; // compact mode for floater
}

export default function GSTCalculator({ compact = false }: GSTCalculatorProps) {
  const [amount, setAmount] = useState('');
  const [slab, setSlab] = useState(18);
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [label, setLabel] = useState('');
  const [showHistory, setShowHistory] = useState(!compact);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // ── Calculate ──
  const numAmount = parseFloat(amount) || 0;
  const compute = useCallback(() => {
    if (!numAmount) return { base: 0, cgst: 0, sgst: 0, total: 0 };
    if (mode === 'add') {
      const gstAmt = numAmount * (slab / 100);
      const half = gstAmt / 2;
      return { base: numAmount, cgst: half, sgst: half, total: numAmount + gstAmt };
    } else {
      // Remove GST from inclusive price
      const base = numAmount / (1 + slab / 100);
      const gstAmt = numAmount - base;
      const half = gstAmt / 2;
      return { base, cgst: half, sgst: half, total: base };
    }
  }, [numAmount, slab, mode]);

  const { base, cgst, sgst, total } = compute();
  const hasResult = numAmount > 0;

  // ── Save to history ──
  const saveToHistory = () => {
    if (!hasResult) return;
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      label: label.trim(),
      amount: numAmount,
      slab,
      mode,
      base,
      cgst,
      sgst,
      total,
      timestamp: Date.now(),
    };
    const updated = [entry, ...history];
    setHistory(updated);
    saveHistory(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLabel('');
  };

  const deleteEntry = (id: string) => {
    const updated = history.filter(e => e.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const restoreEntry = (entry: HistoryEntry) => {
    setAmount(entry.amount.toString());
    setSlab(entry.slab);
    setMode(entry.mode);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <div className={`flex flex-col gap-4 ${compact ? 'w-80' : 'w-full'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-base">GST Calculator</h3>
        </div>
      )}

      {/* GST Slab selector */}
      <div className="flex gap-1.5 flex-wrap">
        {GST_SLABS.map(s => (
          <button
            key={s}
            onClick={() => setSlab(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${slab === s
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            {s}%
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        <button
          onClick={() => setMode('add')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${mode === 'add'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          + Add GST
        </button>
        <button
          onClick={() => setMode('remove')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${mode === 'remove'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          − Remove GST
        </button>
      </div>

      {/* Amount input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full pl-7 pr-4 py-3 rounded-xl border border-border bg-background text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
      </div>

      {/* Result */}
      {hasResult && (
        <ResultPanel base={base} cgst={cgst} sgst={sgst} total={total} mode={mode} slab={slab} />
      )}

      {/* Save row */}
      {hasResult && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveToHistory()}
              placeholder="Add a label (optional)"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={saveToHistory}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${saved
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              : 'bg-foreground text-background hover:opacity-90'
              }`}
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      )}

      {/* History */}
      <div>
        <button
          onClick={() => setShowHistory(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>History</span>
          {history.length > 0 && (
            <span className="ml-1 bg-muted px-1.5 py-0.5 rounded-full">{history.length}</span>
          )}
          {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
        </button>

        {showHistory && (
          <div className="mt-2 space-y-1.5">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No saved calculations yet</p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {history.map(entry => (
                    <HistoryItem
                      key={entry.id}
                      entry={entry}
                      onDelete={deleteEntry}
                      onRestore={restoreEntry}
                    />
                  ))}
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors mt-1"
                >
                  Clear all history
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
