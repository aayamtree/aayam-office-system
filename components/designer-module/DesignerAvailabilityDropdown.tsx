'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface Designer {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'idle' | 'logged_out' | 'absent';
  last_active: string | null;
  first_login_time: string | null;
}

interface DesignerAvailabilityDropdownProps {
  value: string;
  onChange: (designerId: string) => void;
  isAdmin?: boolean;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

const STATUS_CONFIG = {
  active:     { dot: 'bg-green-500',  label: 'Active',      selectable: true,  showWarning: false },
  idle:       { dot: 'bg-yellow-400', label: 'Idle',        selectable: true,  showWarning: false },
  logged_out: { dot: 'bg-gray-400',   label: 'Logged out',  selectable: false, showWarning: true  },
  absent:     { dot: 'bg-gray-300',   label: 'Absent',      selectable: false, showWarning: true  },
};

export default function DesignerAvailabilityDropdown({
  value,
  onChange,
  isAdmin = false,
  label = 'Assign To',
  placeholder = 'Select designer...',
  disabled = false,
}: DesignerAvailabilityDropdownProps) {
  const [open, setOpen] = useState(false);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState<Designer | null>(null);
  const [pendingDesigner, setPendingDesigner] = useState<Designer | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDesigner = designers.find(d => d.id === value);

  const fetchDesigners = async () => {
    try {
      const res = await fetch('/api/designers/available-today');
      const json = await res.json();
      setDesigners(json.data || []);
    } catch (e) {
      console.error('Failed to fetch designers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigners();
    // Auto-refresh every 60 seconds (paused while tab is hidden)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchDesigners();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (designer: Designer) => {
    const config = STATUS_CONFIG[designer.status];
    if (!config.selectable && !isAdmin) return; // non-admin can't pick unavailable

    if (!config.selectable && isAdmin && config.showWarning) {
      // Admin: show confirmation popup
      setPendingDesigner(designer);
      setShowConfirm(designer);
      setOpen(false);
      return;
    }

    onChange(designer.id);
    setOpen(false);
  };

  const confirmUnavailable = () => {
    if (pendingDesigner) {
      onChange(pendingDesigner.id);
      setPendingDesigner(null);
      setShowConfirm(null);
    }
  };

  const getIdleDuration = (d: Designer) => {
    if (!d.last_active) return '';
    const diff = Math.round((Date.now() - new Date(d.last_active).getTime()) / 60000);
    return `Idle ${diff}m ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Loading designers...
          </span>
        ) : selectedDesigner ? (
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedDesigner.status].dot}`} />
            <span>{selectedDesigner.name}</span>
            <span className="text-xs text-gray-400">({STATUS_CONFIG[selectedDesigner.status].label})</span>
          </span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronsUpDown size={14} className="text-gray-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {designers.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">No designers found</div>
          ) : (
            designers.map(d => {
              const cfg = STATUS_CONFIG[d.status];
              const canSelect = cfg.selectable || isAdmin;

              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={!canSelect}
                  onClick={() => handleSelect(d)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors
                    ${canSelect ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-50'}
                    ${value === d.id ? 'bg-primary/10' : ''}
                  `}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{d.name}</span>
                    {d.status === 'idle' && (
                      <span className="text-xs text-yellow-600">{getIdleDuration(d)}</span>
                    )}
                    {!cfg.selectable && (
                      <span className="text-xs text-gray-400">Not available today</span>
                    )}
                  </div>
                  {value === d.id && <Check size={14} className="text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Admin Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <WifiOff size={20} className="text-orange-500" />
              <h3 className="font-bold text-gray-900">Designer Not Available</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              <strong>{showConfirm.name}</strong> is not logged in today ({STATUS_CONFIG[showConfirm.status].label.toLowerCase()}).
              Assign anyway?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(null); setPendingDesigner(null); }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnavailable}
                className="flex-1 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Assign Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
