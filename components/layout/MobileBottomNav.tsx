'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Briefcase, Printer, Palette, Megaphone,
    IndianRupee, Truck, Users, FileText, Calendar, Settings,
    User, ChevronUp, X, Check, GripVertical
} from 'lucide-react';

interface NavItem {
    id: string;
    label: string;
    icon: any;
    href: string;
    roles: string[];
}

// All available nav items (role-filtered)
const ALL_NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, href: '/admin/dashboard', roles: ['admin', 'finance'] },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, href: '/admin/jobs', roles: ['admin', 'finance'] },
    { id: 'print', label: 'Print', icon: Printer, href: '/admin/print-planner', roles: ['admin', 'finance', 'cmyk'] },
    { id: 'design', label: 'Design', icon: Palette, href: '/admin/designers/tasks?view=board', roles: ['admin', 'designer'] },
    { id: 'marketing', label: 'Marketing', icon: Megaphone, href: '/admin/marketing/leads', roles: ['admin', 'finance', 'marketing'] },
    { id: 'crm', label: 'Clients', icon: Users, href: '/admin/crm/clients', roles: ['admin', 'finance', 'marketing'] },
    { id: 'finance', label: 'Finance', icon: IndianRupee, href: '/admin/finance', roles: ['admin', 'finance'] },
    { id: 'dispatch', label: 'Dispatch', icon: Truck, href: '/admin/dispatch', roles: ['admin', 'dispatch'] },
    { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/admin/calendar', roles: ['admin', 'finance', 'designer', 'marketing', 'dispatch'] },
    { id: 'reports', label: 'Reports', icon: FileText, href: '/admin/reports', roles: ['admin', 'finance'] },
    { id: 'eod', label: 'EOD', icon: FileText, href: '/admin/eod-report', roles: ['admin', 'finance', 'designer', 'marketing', 'dispatch'] },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings', roles: ['admin'] },
];

// Default tabs per role (first 3 before Account)
const ROLE_DEFAULTS: Record<string, string[]> = {
    admin: ['dashboard', 'jobs', 'finance', 'print'],
    finance: ['dashboard', 'finance', 'jobs', 'reports'],
    designer: ['design', 'calendar', 'eod', 'jobs'],
    marketing: ['marketing', 'crm', 'calendar', 'eod'],
    dispatch: ['dispatch', 'calendar', 'eod', 'jobs'],
    cmyk: ['print', 'calendar', 'eod', 'jobs'],
};

const STORAGE_KEY = 'aayam_bottom_nav_tabs';

export function MobileBottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { profile } = useAuth();
    const [showCustomizer, setShowCustomizer] = useState(false);
    const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
    const [tempTabs, setTempTabs] = useState<string[]>([]);

    const userRole = profile?.role || 'admin';

    // Available items for this user's role
    const availableItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(userRole));

    // Load saved tabs or use role defaults
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validate saved tabs are still available for this role
                const valid = parsed.filter((id: string) =>
                    availableItems.some(item => item.id === id)
                );
                if (valid.length >= 4) {
                    setSelectedTabs(valid.slice(0, 4));
                    return;
                }
            } catch { }
        }
        // Use role defaults
        const defaults = ROLE_DEFAULTS[userRole] || ROLE_DEFAULTS.admin;
        const validDefaults = defaults.filter(id =>
            availableItems.some(item => item.id === id)
        );
        setSelectedTabs(validDefaults.slice(0, 4));
    }, [userRole]);

    // Save when tabs change
    useEffect(() => {
        if (selectedTabs.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedTabs));
        }
    }, [selectedTabs]);

    const activeTabItems = selectedTabs
        .map(id => ALL_NAV_ITEMS.find(item => item.id === id))
        .filter(Boolean) as NavItem[];

    const isActive = (href: string) => {
        if (href === '/admin/dashboard') return pathname === '/admin/dashboard';
        return pathname.startsWith(href.split('?')[0]);
    };

    const isProfileActive = pathname.startsWith('/admin/settings/profile');

    // Customizer
    const openCustomizer = () => {
        setTempTabs([...selectedTabs]);
        setShowCustomizer(true);
    };

    const toggleTempTab = (id: string) => {
        if (tempTabs.includes(id)) {
            setTempTabs(prev => prev.filter(t => t !== id));
        } else if (tempTabs.length < 4) {
            setTempTabs(prev => [...prev, id]);
        }
    };

    const saveCustomTabs = () => {
        if (tempTabs.length === 4) {
            setSelectedTabs(tempTabs);
            setShowCustomizer(false);
        }
    };

    // Don't render on login page
    if (pathname === '/login' || pathname === '/') return null;

    return (
        <>
            {/* Bottom Nav Bar - Mobile Only */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 lg:hidden safe-area-bottom">
                <div className="flex items-stretch justify-around h-14">
                    {/* Dynamic Tabs (4 slots) */}
                    {activeTabItems.map(item => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <button
                                key={item.id}
                                onClick={() => router.push(item.href)}
                                className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${active
                                    ? 'text-gray-900'
                                    : 'text-gray-400'
                                    }`}
                            >
                                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                                <span className={`text-[10px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}

                    {/* Account Button (Permanent) */}
                    <button
                        onClick={() => router.push('/admin/settings/profile')}
                        className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${isProfileActive ? 'text-gray-900' : 'text-gray-400'
                            }`}
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isProfileActive
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-200 text-gray-600'
                            }`}>
                            {profile?.full_name?.charAt(0) || 'U'}
                        </div>
                        <span className={`text-[10px] leading-tight ${isProfileActive ? 'font-bold' : 'font-medium'}`}>
                            Account
                        </span>
                    </button>

                    {/* Customize Button */}
                    <button
                        onClick={openCustomizer}
                        className="flex flex-col items-center justify-center w-10 gap-0.5 text-gray-300"
                        aria-label="Customize tabs"
                    >
                        <ChevronUp size={14} />
                    </button>
                </div>
            </nav>

            {/* Customizer Modal */}
            {showCustomizer && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCustomizer(false)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-hidden animate-slide-up">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Customize Navigation</h3>
                                <p className="text-xs text-gray-500">Select 4 quick access buttons</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={saveCustomTabs}
                                    disabled={tempTabs.length !== 4}
                                    className="px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium disabled:opacity-40"
                                >
                                    <Check size={14} className="inline mr-1" />
                                    Save
                                </button>
                                <button
                                    onClick={() => setShowCustomizer(false)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Current Selection Preview */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                                Selected ({tempTabs.length}/4)
                            </p>
                            <div className="flex gap-2">
                                {[0, 1, 2, 3].map(i => {
                                    const item = ALL_NAV_ITEMS.find(n => n.id === tempTabs[i]);
                                    return (
                                        <div
                                            key={i}
                                            className={`flex-1 py-2 rounded-md text-center text-xs font-medium border ${item
                                                ? 'bg-gray-900 text-white border-gray-900'
                                                : 'bg-white text-gray-300 border-dashed border-gray-300'
                                                }`}
                                        >
                                            {item ? item.label : 'Empty'}
                                        </div>
                                    );
                                })}
                                <div className="flex-1 py-2 rounded-md text-center text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                    Account ✓
                                </div>
                            </div>
                        </div>

                        {/* Available Items */}
                        <div className="overflow-y-auto p-4 space-y-1.5 max-h-[40vh]">
                            {availableItems.map(item => {
                                const Icon = item.icon;
                                const isSelected = tempTabs.includes(item.id);
                                const isFull = tempTabs.length >= 4 && !isSelected;

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => toggleTempTab(item.id)}
                                        disabled={isFull}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${isSelected
                                            ? 'bg-gray-900 text-white'
                                            : isFull
                                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-100'
                                            }`}
                                    >
                                        <Icon size={18} />
                                        <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                                        {isSelected && (
                                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                                Slot {tempTabs.indexOf(item.id) + 1}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Add padding to main content so it's not hidden behind the nav bar */}
            <style jsx global>{`
                @media (max-width: 1023px) {
                    main {
                        padding-bottom: 72px !important;
                    }
                }
                .safe-area-bottom {
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.25s ease-out;
                }
            `}</style>
        </>
    );
}
