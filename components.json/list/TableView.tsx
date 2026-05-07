'use client';

import { ReactNode } from 'react';
import { ColumnConfig } from './types';

interface TableViewProps<T> {
    /** Array of items to display */
    data: T[];

    /** Column configuration */
    columns: ColumnConfig<T>[];

    /** Function to extract unique ID from item */
    keyExtractor: (item: T) => string;

    /** Selected items */
    selectedItems?: Set<string>;

    /** Selection change handler */
    onSelectionChange?: (item: T, selected: boolean) => void;

    /** Row click handler */
    onRowClick?: (item: T) => void;

    /** Enable row selection */
    enableSelection?: boolean;

    /** Loading state */
    loading?: boolean;

    /** Empty message */
    emptyMessage?: string;
}

/**
 * Table View Component (Desktop)
 * 
 * Full table layout for desktop views
 * Follows design guidelines:
 * - 14px font-size for header and cells
 * - 12px padding vertical, 16px horizontal
 * - Row height: 48px
 * - Hover: bg-gray-50
 * - Sortable headers
 */
export function TableView<T>({
    data,
    columns,
    keyExtractor,
    selectedItems,
    onSelectionChange,
    onRowClick,
    enableSelection = false,
    loading = false,
    emptyMessage = 'No items to display',
}: TableViewProps<T>) {
    return (
        <div className="overflow-x-auto bg-white">
            <table className="w-full border-collapse">
                {/* Header */}
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                        {/* Selection column */}
                        {enableSelection && (
                            <th className="w-12 px-4 py-3 text-left">
                                <input
                                    type="checkbox"
                                    className="w-[18px] h-[18px] rounded border-2 border-gray-300 text-[#0000FF] cursor-pointer"
                                    onChange={(e) => {
                                        // Handle select all
                                    }}
                                />
                            </th>
                        )}

                        {/* Data columns */}
                        {columns.map((column) => (
                            <th
                                key={column.id}
                                className="px-4 py-3 text-left text-sm font-medium text-gray-600"
                                style={{ width: column.width }}
                            >
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* Body */}
                <tbody>
                    {loading ? (
                        <tr>
                            <td
                                colSpan={columns.length + (enableSelection ? 1 : 0)}
                                className="px-4 py-12 text-center text-sm text-gray-500"
                            >
                                Loading...
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length + (enableSelection ? 1 : 0)}
                                className="px-4 py-12 text-center text-sm text-gray-500"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((item) => {
                            const itemId = keyExtractor(item);
                            const isSelected = selectedItems?.has(itemId);

                            return (
                                <tr
                                    key={itemId}
                                    onClick={() => onRowClick?.(item)}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                                >
                                    {/* Selection checkbox */}
                                    {enableSelection && (
                                        <td
                                            className="px-4 py-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) =>
                                                    onSelectionChange?.(item, e.target.checked)
                                                }
                                                className="w-[18px] h-[18px] rounded border-2 border-gray-300 text-[#0000FF] cursor-pointer"
                                            />
                                        </td>
                                    )}

                                    {/* Data cells */}
                                    {columns.map((column) => (
                                        <td
                                            key={column.id}
                                            className="px-4 py-3 text-sm text-gray-900"
                                        >
                                            {column.render(item)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
