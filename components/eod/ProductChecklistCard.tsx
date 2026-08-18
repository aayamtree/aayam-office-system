'use client';

import { useState, useEffect } from 'react';
import { Check, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';

interface ChecklistItem {
    item: string;
    checked: boolean;
    comment: string;
    order: number;
}

interface ProductChecklistCardProps {
    productCategory: string;
    taskStatus: 'NOT START' | 'START WORK' | 'COMPLETE';
    checklistItems: ChecklistItem[];
    onUpdate: (items: ChecklistItem[]) => void;
    category?: 'design' | 'dispatch';
}

// Status-specific checklists for NOT START and START WORK
const STATUS_CHECKLISTS = {
    'NOT START': [
        'Details Received from Client',
        'Resources & Assets Available',
        'Timeline & Deadline Clear',
        'Requirements Understood'
    ],
    'START WORK': [
        'Image Setup Complete',
        'Text Content Placed',
        'Color Scheme Finalized',
        'Initial Draft Ready'
    ]
};

export default function ProductChecklistCard({
    productCategory,
    taskStatus,
    checklistItems,
    onUpdate,
    category = 'design'
}: ProductChecklistCardProps) {
    const [items, setItems] = useState<ChecklistItem[]>(checklistItems);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

    useEffect(() => {
        setItems(checklistItems);
    }, [checklistItems]);

    const toggleItem = (index: number) => {
        const updated = [...items];
        updated[index].checked = !updated[index].checked;
        setItems(updated);
        onUpdate(updated);
    };

    const updateComment = (index: number, comment: string) => {
        const updated = [...items];
        updated[index].comment = comment;
        setItems(updated);
        onUpdate(updated);
    };

    const toggleExpand = (index: number) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedItems(newExpanded);
    };

    // Calculate completion percentage
    const completionRate = items.length > 0
        ? Math.round((items.filter(item => item.checked).length / items.length) * 100)
        : 0;

    const getStatusColor = () => {
        switch (taskStatus) {
            case 'NOT START': return 'text-gray-500 bg-gray-50';
            case 'START WORK': return 'text-blue-600 bg-blue-50';
            case 'COMPLETE': return 'text-green-600 bg-green-50';
            default: return 'text-gray-500 bg-gray-50';
        }
    };

    if (items.length === 0) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                No checklist items configured for this product type
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className={`p-4 flex items-center justify-between ${getStatusColor()} border-b`}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        <span className="font-bold">
                            {taskStatus === 'COMPLETE' ? `${productCategory} Checklist` : `${taskStatus} Checklist`}
                        </span>
                    </div>
                    {taskStatus === 'COMPLETE' && (
                        <span className="text-xs bg-white px-2 py-1 rounded-md font-medium">
                            {category === 'design' ? 'Pre-Print' : 'QC & Dispatch'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-sm font-bold">
                        {completionRate}%
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all ${completionRate === 100 ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                            style={{ width: `${completionRate}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Checklist Items */}
            <div className="divide-y divide-gray-100">
                {items.map((item, index) => (
                    <div key={index} className="hover:bg-gray-50 transition-colors">
                        <div className="p-3 flex items-start gap-3">
                            {/* Checkbox — type="button" is required: this card renders inside the EOD <form>, and a button without a type defaults to type="submit", which submits the whole report on every tick */}
                            <button
                                type="button"
                                onClick={() => toggleItem(index)}
                                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${item.checked
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-gray-300 hover:border-blue-400'
                                    }`}
                            >
                                {item.checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </button>

                            {/* Item Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                        {/* item.item can be a raw {label,type,required} object in reports saved before the normalisation fix — render its label, never the object */}
                                        {typeof item.item === 'string' ? item.item : ((item.item as any)?.label || '')}
                                    </span>
                                    {item.comment && (
                                        <MessageSquare className="w-3 h-3 text-blue-500" />
                                    )}
                                </div>

                                {/* Comment Section */}
                                {(expandedItems.has(index) || item.checked) && (
                                    <div className="mt-2 animate-in slide-in-from-top-1 fade-in">
                                        <textarea
                                            value={item.comment}
                                            onChange={(e) => updateComment(index, e.target.value)}
                                            placeholder="Add comments or notes (optional)..."
                                            className="w-full text-xs border border-gray-200 rounded-md p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                            rows={2}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Expand/Collapse Button */}
                            <button
                                type="button"
                                onClick={() => toggleExpand(index)}
                                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                title={expandedItems.has(index) ? 'Hide comment' : 'Add comment'}
                            >
                                {expandedItems.has(index) ? (
                                    <ChevronDown className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            {completionRate === 100 && (
                <div className="p-3 bg-green-50 border-t border-green-100 flex items-center gap-2 text-sm text-green-700">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">All checks completed!</span>
                </div>
            )}
        </div>
    );
}
