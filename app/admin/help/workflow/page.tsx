'use client';

import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WorkflowPage() {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'base',
            themeVariables: {
                primaryColor: '#e0e7ff',
                edgeLabelBackground: '#ffffff',
                tertiaryColor: '#f3e8ff'
            }
        });

        // Explicitly render
        if (chartRef.current) {
            mermaid.contentLoaded();
        }
    }, []);

    const chart = `
graph TD
    %% Nodes
    Lead[("📢 Lead (Marketing)")]
    Quote[("📄 Quotation")]
    Order[("🛒 Sales Order")]
    Job[("⚙️ Job / Production")]
    Design[("🎨 Design Task")]
    Print[("🖨️ Printing & Finishing")]
    QC[("✅ QC Checklist")]
    Dispatch[("🚚 Dispatch")]
    Invoice[("💰 Invoice")]
    Payment[("💵 Payment")]

    %% Connections
    Lead -->|1. Inquiry| Quote
    Quote -->|2. Client Accepts| Order
    Order -->|3. Confirm & Create| Job
    
    subgraph PRODUCTION
        Job -->|4a. Assign| Design
        Design -->|4b. Design QC| Print
        Job -->|4c. Print Only| Print
        Print -->|5. Production| QC
        QC -->|6. Dispatch QC| Dispatch
    end

    subgraph FINANCE
        Order -.->|7a. Bill| Invoice
        Invoice -->|7b. Collect| Payment
        Payment -->|8. Clear| Dispatch
    end

    %% Styles
    style Lead fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style Quote fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    style Order fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style Job fill:#f3e8ff,stroke:#9333ea,stroke-width:2px
    style Design fill:#fae8ff,stroke:#d946ef,stroke-width:2px
    style Print fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px
    style QC fill:#ccfbf1,stroke:#0d9488,stroke-width:2px
    style Dispatch fill:#ffedd5,stroke:#ea580c,stroke-width:2px
    style Invoice fill:#ecfccb,stroke:#65a30d,stroke-width:2px
  `;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">System Workflow Blueprint</h1>
                    <p className="text-gray-500">Visual guide to the Aayam Office System process.</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Process Flowchart</h2>
                <div className="mermaid flex justify-center min-w-[800px]">
                    {chart}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">1</div>
                        <h3 className="text-lg font-bold">Marketing & Sales</h3>
                    </div>
                    <ul className="space-y-3 text-gray-600 text-sm">
                        <li>• Create <strong>Lead</strong> (Inquiry)</li>
                        <li>• Generate <strong>Quotation</strong> from Lead</li>
                        <li>• Convert Quote to <strong>Sales Order</strong> (Confirmed)</li>
                    </ul>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">2</div>
                        <h3 className="text-lg font-bold">Design Studio</h3>
                    </div>
                    <ul className="space-y-3 text-gray-600 text-sm">
                        <li>• Job assigned to Designer (Task)</li>
                        <li>• <strong>Design QC Checklist</strong> (Bleed, Colors)</li>
                        <li>• Client Approval & Release to Print</li>
                    </ul>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">3</div>
                        <h3 className="text-lg font-bold">Production & Dispatch</h3>
                    </div>
                    <ul className="space-y-3 text-gray-600 text-sm">
                        <li>• <strong>Printing & Finishing</strong> steps</li>
                        <li>• <strong>Dispatch QC Checklist</strong> (Physical Check)</li>
                        <li>• Generate Challan & Dispatch</li>
                    </ul>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">4</div>
                        <h3 className="text-lg font-bold">Finance</h3>
                    </div>
                    <ul className="space-y-3 text-gray-600 text-sm">
                        <li>• Generate <strong>Invoice</strong> from Order</li>
                        <li>• Collect <strong>Payment</strong></li>
                        <li>• Track Outstanding Balances</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
