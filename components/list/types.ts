import { ReactNode } from 'react';

/**
 * Props for responsive list view component
 */
export interface ResponsiveListViewProps<T> {
    /** Array of items to display */
    data: T[];

    /** Function to extract unique ID from item */
    keyExtractor: (item: T) => string;

    /** Sections configuration for grouping items */
    sections?: SectionConfig<T>[];

    /** Mobile view configuration */
    mobileView?: 'compact-list' | 'cards';

    /** Desktop view configuration */
    desktopView?: 'table' | 'list' | 'cards';

    /** Breakpoint for switching between mobile and desktop (default: 768) */
    breakpoint?: number;

    /** Columns configuration for desktop table view */
    columns?: ColumnConfig<T>[];

    /** Render function for mobile list items */
    renderMobileItem?: (item: T) => ReactNode;

    /** Render function for desktop table rows */
    renderDesktopRow?: (item: T) => ReactNode;

    /** Loading state */
    loading?: boolean;

    /** Empty state message */
    emptyMessage?: string;

    /** Error state */
    error?: string | null;

    /** Callback when item is clicked */
    onItemClick?: (item: T) => void;

    /** Callback when item is selected (checkbox) */
    onItemSelect?: (item: T, selected: boolean) => void;

    /** Selected items */
    selectedItems?: Set<string>;

    /** Enable search */
    enableSearch?: boolean;

    /** Search placeholder */
    searchPlaceholder?: string;

    /** Filters configuration */
    filters?: FilterConfig[];

    /** Custom toolbar actions */
    toolbarActions?: ReactNode;
}

/**
 * Section configuration for grouping items
 */
export interface SectionConfig<T> {
    /** Section identifier */
    id: string;

    /** Section title */
    title: string;

    /** Function to determine if item belongs to this section */
    matcher: (item: T) => boolean;

    /** Default expanded state */
    defaultExpanded?: boolean;

    /** Urgency level (affects badge color) */
    urgency?: 'normal' | 'warning' | 'danger';

    /** Custom icon */
    icon?: ReactNode;

    /** Section actions */
    actions?: ReactNode;
}

/**
 * Column configuration for desktop table view
 */
export interface ColumnConfig<T> {
    /** Column identifier */
    id: string;

    /** Column header label */
    label: string;

    /** Column width (CSS value) */
    width?: string;

    /** Render function for cell content */
    render: (item: T) => ReactNode;

    /** Enable sorting */
    sortable?: boolean;

    /** Sort function */
    sortFn?: (a: T, b: T) => number;

    /** Responsive visibility */
    hideOnMobile?: boolean;
    hideOnTablet?: boolean;
}

/**
 * Filter configuration
 */
export interface FilterConfig {
    /** Filter identifier */
    id: string;

    /** Filter label */
    label: string;

    /** Filter type */
    type: 'select' | 'multiselect' | 'date' | 'daterange';

    /** Options for select/multiselect */
    options?: { value: string; label: string }[];

    /** Current value */
    value?: any;

    /** Change handler */
    onChange: (value: any) => void;
}
