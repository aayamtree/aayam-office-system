'use client';

import { useState } from 'react';
import { Plus, Phone, Mail, Calendar, DollarSign, Search } from 'lucide-react';
import {
    ResponsiveListView,
    StatusBadge,
    MetadataItem,
    ColumnConfig,
    SectionConfig,
} from '@/components/list';

// Sample data type
interface SampleLead {
    id: string;
    name: string;
    company: string;
    phone: string;
    email: string;
    amount: number;
    status: 'new' | 'contacted' | 'quotation' | 'follow_up' | 'converted';
    nextFollowUp: string;
    requirement: string;
}

// Sample data
const sampleLeads: SampleLead[] = [
    {
        id: '1',
        name: 'Raj Kumar',
        company: 'ABC Prints Pvt Ltd',
        phone: '9876543210',
        email: 'raj@abcprints.com',
        amount: 50000,
        status: 'new',
        nextFollowUp: 'Today',
        requirement: '1000 Visiting Cards',
    },
    {
        id: '2',
        name: 'Priya Sharma',
        company: 'XYZ Solutions',
        phone: '9988776655',
        email: 'priya@xyzsolutions.com',
        amount: 120000,
        status: 'new',
        nextFollowUp: 'Nov 25',
        requirement: 'Brochure Design & Print',
    },
    {
        id: '3',
        name: 'Amit Patel',
        company: 'Tech Innovations',
        phone: '9123456789',
        email: 'amit@techinnovations.com',
        amount: 75000,
        status: 'contacted',
        nextFollowUp: 'Tomorrow',
        requirement: 'Corporate Stationery',
    },
    {
        id: '4',
        name: 'Sneha Desai',
        company: 'Creative Hub',
        phone: '9876123456',
        email: 'sneha@creativehub.com',
        amount: 200000,
        status: 'quotation',
        nextFollowUp: 'Nov 30',
        requirement: 'Office Branding Package',
    },
    {
        id: '5',
        name: 'Rahul Mehta',
        company: 'Startup Nest',
        phone: '9998887776',
        email: 'rahul@startupnest.com',
        amount: 35000,
        status: 'follow_up',
        nextFollowUp: 'Dec 1',
        requirement: 'Event Banners',
    },
];

/**
 * Component Demo Page
 * 
 * Demonstrates responsive list components with sample lead data
 */
export default function ComponentDemoPage() {
    const [selectedStatus, setSelectedStatus] = useState<string>('');

    // Filter data
    const filteredLeads = selectedStatus
        ? sampleLeads.filter((lead) => lead.status === selectedStatus)
        : sampleLeads;

    // Section configuration
    const sections: SectionConfig<SampleLead>[] = [
        {
            id: 'new',
            title: 'New',
            matcher: (lead) => lead.status === 'new',
            defaultExpanded: true,
            urgency: 'normal',
        },
        {
            id: 'contacted',
            title: 'Contacted',
            matcher: (lead) => lead.status === 'contacted',
            defaultExpanded: true,
            urgency: 'normal',
        },
        {
            id: 'quotation',
            title: 'Quotation Sent',
            matcher: (lead) => lead.status === 'quotation',
            defaultExpanded: false,
            urgency: 'warning',
        },
        {
            id: 'follow_up',
            title: 'Follow-up Required',
            matcher: (lead) => lead.status === 'follow_up',
            defaultExpanded: true,
            urgency: 'warning',
        },
        {
            id: 'converted',
            title: 'Converted',
            matcher: (lead) => lead.status === 'converted',
            defaultExpanded: false,
            urgency: 'normal',
        },
    ];

    // Desktop columns
    const columns: ColumnConfig<SampleLead>[] = [
        {
            id: 'name',
            label: 'Name',
            width: '180px',
            render: (lead) => (
                <div>
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    <div className="text-xs text-gray-500">{lead.company}</div>
                </div>
            ),
        },
        {
            id: 'contact',
            label: 'Contact',
            width: '180px',
            render: (lead) => (
                <div className="text-sm space-y-1">
                    <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{lead.email}</span>
                    </div>
                </div>
            ),
        },
        {
            id: 'requirement',
            label: 'Requirement',
            width: '200px',
            render: (lead) => (
                <div className="text-sm text-gray-700">{lead.requirement}</div>
            ),
        },
        {
            id: 'amount',
            label: 'Amount',
            width: '120px',
            render: (lead) => (
                <div className="font-medium text-gray-900">
                    ₹{lead.amount.toLocaleString('en-IN')}
                </div>
            ),
        },
        {
            id: 'status',
            label: 'Status',
            width: '120px',
            render: (lead) => (
                <StatusBadge
                    label={lead.status.replace('_', ' ').toUpperCase()}
                    variant={
                        lead.status === 'new'
                            ? 'new'
                            : lead.status === 'converted'
                                ? 'active'
                                : lead.status === 'follow_up'
                                    ? 'warning'
                                    : 'new'
                    }
                />
            ),
        },
        {
            id: 'follow_up',
            label: 'Next Follow-up',
            width: '120px',
            render: (lead) => (
                <MetadataItem
                    icon={<Calendar className="w-4 h-4 md:w-4 md:h-4" />}
                    label={lead.nextFollowUp}
                    variant={lead.nextFollowUp === 'Today' ? 'danger' : 'default'}
                />
            ),
        },
    ];

    // Mobile item renderer
    const renderMobileItem = (lead: SampleLead) => (
        <div className="flex items-start gap-3 py-3 px-4 bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
            <input
                type="checkbox"
                className="w-[18px] h-[18px] mt-0.5 rounded border-2 border-gray-300 text-[#0000FF] cursor-pointer"
            />

            <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="text-sm font-medium text-gray-900 mb-1">
                    {lead.name}
                </div>

                {/* Subtitle */}
                <div className="text-[13px] text-gray-600 mb-1">
                    {lead.company} • <Phone className="inline w-2.5 h-2.5 md:w-3.5 md:h-3.5" /> {lead.phone}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                    <span className="font-medium">₹{lead.amount.toLocaleString('en-IN')}</span>
                    <span>•</span>
                    <span>{lead.requirement}</span>
                    <span>•</span>
                    <MetadataItem
                        icon={<Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                        label={lead.nextFollowUp}
                        variant={lead.nextFollowUp === 'Today' ? 'danger' : 'muted'}
                    />
                </div>
            </div>

            <div className="flex-shrink-0">
                <StatusBadge
                    label={lead.status.replace('_', ' ').toUpperCase()}
                    variant={
                        lead.status === 'new'
                            ? 'new'
                            : lead.status === 'converted'
                                ? 'active'
                                : lead.status === 'follow_up'
                                    ? 'warning'
                                    : 'new'
                    }
                />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Page Header */}
            <div className="bg-white border-b border-gray-100">
                <div className="w-full px-4 md:max-w-7xl md:mx-auto md:px-6 lg:px-8 py-4 md:py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Component Demo
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Responsive List View Components - Mobile & Desktop
                            </p>
                        </div>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#0000FF] text-white font-semibold rounded-lg hover:bg-[#0000CC] transition-colors">
                            <Plus className="w-4 h-4 md:w-5 md:h-5" />
                            Add Lead
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="w-full md:max-w-7xl md:mx-auto md:px-4 md:py-8">
                <ResponsiveListView
                    data={filteredLeads}
                    keyExtractor={(lead) => lead.id}
                    sections={sections}
                    columns={columns}
                    renderMobileItem={renderMobileItem}
                    enableSearch
                    searchPlaceholder="Search leads..."
                    filters={[
                        {
                            id: 'status',
                            label: 'Filter by Status',
                            type: 'select',
                            value: selectedStatus,
                            onChange: setSelectedStatus,
                            options: [
                                { value: 'new', label: 'New' },
                                { value: 'contacted', label: 'Contacted' },
                                { value: 'quotation', label: 'Quotation' },
                                { value: 'follow_up', label: 'Follow-up' },
                                { value: 'converted', label: 'Converted' },
                            ],
                        },
                    ]}
                    toolbarActions={
                        <button className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                            Export
                        </button>
                    }
                    onItemClick={(lead) => {
                        console.log('Clicked:', lead);
                    }}
                />
            </div>
        </div>
    );
}
