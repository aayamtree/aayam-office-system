'use client';

import { ReactNode, useState } from 'react';
import { Filter, SortAsc } from 'lucide-react';
import { useResponsive, useSelection } from './hooks';
import { CollapsibleSection } from './CollapsibleSection';
import { CompactListItem } from './CompactListItem';
import { TableView } from './TableView';
import { ResponsiveListViewProps, SectionConfig } from './types';

/**
 * Responsive List View Component
 * 
 * Main wrapper component that adapts between mobile and desktop views
 * - Mobile: Collapsible sections with compact list items
 * - Desktop: Full table view
 * 
 * Follows responsive breakpoint: 768px
 */
export function ResponsiveListView<T>({
    data,
    keyExtractor,
    sections = [],
    mobileView = 'compact-list',
    desktopView = 'table',
    breakpoint = 768,
    columns = [],
    renderMobileItem,
    renderDesktopRow,
    loading = false,
    emptyMessage = 'No items to display',
    error = null,
    onItemClick,
    onItemSelect,
    selectedItems,
    enableSearch = false,
    searchPlaceholder = 'Search...',
    filters = [],
    toolbarActions,
}: ResponsiveListViewProps<T>) {
    const { isMobile, isDesktop } = useResponsive(breakpoint);
    const [searchQuery, setSearchQuery] = useState('');

    // Group items by sections
    const groupedData = sections.length > 0
        ? sections.map((section) => ({
            section,
            items: data.filter((item) => section.matcher(item)),
        }))
        : [{ section: null, items: data }];

    // Error state
    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-600 font-medium mb-2">Error</div>
                <div className="text-gray-600 text-sm">{error}</div>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    // Empty state
    if (data.length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="text-gray-500">{emptyMessage}</div>
            </div>
        );
    }

    return (
        <div className="responsive-list-view">
            {/* Toolbar */}
            {(enableSearch || filters.length > 0 || toolbarActions) && (
                <div className="toolbar bg-white border-b border-gray-100">
                    {/* Mobile: Stack vertically */}
                    <div className="flex flex-col gap-3 p-4 md:hidden">
                        {/* Search - Full width on mobile */}
                        {enableSearch && (
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                                />
                            </div>
                        )}

                        {/* Filters - Stack on mobile */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {filters.length > 0 && filters.map((filter) => (
                                <select
                                    key={filter.id}
                                    value={filter.value}
                                    onChange={(e) => filter.onChange(e.target.value)}
                                    className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-primary cursor-pointer"
                                >
                                    <option value="">{filter.label}</option>
                                    {filter.options?.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            ))}

                            {/* Actions on mobile */}
                            {toolbarActions && toolbarActions}
                        </div>
                    </div>

                    {/* Desktop: Horizontal layout */}
                    <div className="hidden md:flex items-center gap-3 p-4">
                        {/* Search */}
                        {enableSearch && (
                            <div className="relative flex-1 max-w-md">
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                                />
                            </div>
                        )}

                        {/* Filters */}
                        {filters.length > 0 && (
                            <div className="flex items-center gap-2">
                                {filters.map((filter) => (
                                    <select
                                        key={filter.id}
                                        value={filter.value}
                                        onChange={(e) => filter.onChange(e.target.value)}
                                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-primary cursor-pointer"
                                    >
                                        <option value="">{filter.label}</option>
                                        {filter.options?.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                ))}
                            </div>
                        )}

                        {/* Custom toolbar actions */}
                        {toolbarActions && <div className="ml-auto">{toolbarActions}</div>}
                    </div>
                </div>
            )}

            {/* Content */}
            {isMobile ? (
                // Mobile: Collapsible sections
                <div className="mobile-list">
                    {groupedData.map(({ section, items }, index) => {
                        if (items.length === 0) return null;

                        const content = items.map((item) => {
                            const itemId = keyExtractor(item);
                            const isSelected = selectedItems?.has(itemId);

                            return renderMobileItem ? (
                                <div key={itemId}>{renderMobileItem(item)}</div>
                            ) : (
                                <CompactListItem
                                    key={itemId}
                                    title={itemId}
                                    checked={isSelected}
                                    onClick={() => onItemClick?.(item)}
                                    onCheckChange={(checked) => onItemSelect?.(item, checked)}
                                />
                            );
                        });

                        return section ? (
                            <CollapsibleSection
                                key={section.id}
                                title={section.title}
                                count={items.length}
                                defaultExpanded={section.defaultExpanded}
                                urgency={section.urgency}
                                icon={section.icon}
                                actions={section.actions}
                            >
                                {content}
                            </CollapsibleSection>
                        ) : (
                            <div key={index}>{content}</div>
                        );
                    })}
                </div>
            ) : (
                // Desktop: Table view with section rows
                <div className="desktop-table">
                    {sections.length > 0 ? (
                        // With sections
                        groupedData.map(({ section, items }, index) => {
                            if (items.length === 0) return null;

                            return (
                                <div key={section?.id || index} className="mb-6">
                                    {section && (
                                        <CollapsibleSection
                                            title={section.title}
                                            count={items.length}
                                            defaultExpanded={section.defaultExpanded}
                                            urgency={section.urgency}
                                            icon={section.icon}
                                            actions={section.actions}
                                        >
                                            <TableView
                                                data={items}
                                                columns={columns}
                                                keyExtractor={keyExtractor}
                                                selectedItems={selectedItems}
                                                onSelectionChange={onItemSelect}
                                                onRowClick={onItemClick}
                                                enableSelection={!!onItemSelect}
                                            />
                                        </CollapsibleSection>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        // No sections - just table
                        <TableView
                            data={data}
                            columns={columns}
                            keyExtractor={keyExtractor}
                            selectedItems={selectedItems}
                            onSelectionChange={onItemSelect}
                            onRowClick={onItemClick}
                            enableSelection={!!onItemSelect}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
