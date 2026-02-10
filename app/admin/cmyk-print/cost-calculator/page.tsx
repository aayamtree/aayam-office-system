'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, Package, IndianRupee } from 'lucide-react';
import { usePaperStock } from '@/lib/hooks';
import { PaperStock } from '@/types/database';
import { Button } from '@/components/ui/Button';

export default function CostCalculatorPage() {
    const { stock: paperStock, loading } = usePaperStock();

    const [selectedPaperId, setSelectedPaperId] = useState('');
    const [quantity, setQuantity] = useState(1000);
    const [upsPerSheet, setUpsPerSheet] = useState(1);

    // Derived paper info
    const selectedPaper = paperStock.find((p: PaperStock) => p.id === selectedPaperId);

    // Calculations
    const sheetsNeeded = upsPerSheet > 0 ? Math.ceil(quantity / upsPerSheet) : 0;
    const paperCost = sheetsNeeded * (selectedPaper?.cost_per_unit || 0);
    const costPerPiece = quantity > 0 ? paperCost / quantity : 0;

    // Auto-select first paper
    useEffect(() => {
        if (paperStock.length > 0 && !selectedPaperId) {
            setSelectedPaperId(paperStock[0].id);
        }
    }, [paperStock, selectedPaperId]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/admin/cmyk-print" className="p-2 hover:bg-white rounded-lg border border-gray-100 bg-gray-50 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-page-title text-gray-900 tracking-tight">Paper Cost Calculator</h1>
                    <p className="text-sm text-gray-500 mt-1">Estimate paper costs from your inventory</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-5">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-gray-400" />
                        Input Parameters
                    </h2>

                    {/* Paper Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Paper</label>
                        {loading ? (
                            <p className="text-sm text-gray-400">Loading paper stock...</p>
                        ) : paperStock.length === 0 ? (
                            <div className="text-sm text-gray-500">
                                No paper in stock.{' '}
                                <Link href="/admin/cmyk-print/paper-stock" className="text-primary underline">Add paper stock</Link>
                            </div>
                        ) : (
                            <select
                                value={selectedPaperId}
                                onChange={(e) => setSelectedPaperId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-gray-400"
                            >
                                {paperStock.map((p: PaperStock) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.gsm ? `(${p.gsm} GSM)` : ''} {p.size ? `— ${p.size}` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Paper Info Card */}
                    {selectedPaper && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">GSM</p>
                                <p className="font-medium text-gray-900">{selectedPaper.gsm || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Size</p>
                                <p className="font-medium text-gray-900">{selectedPaper.size || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Cost / Sheet</p>
                                <p className="font-medium text-gray-900">{formatCurrency(selectedPaper.cost_per_unit)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">In Stock</p>
                                <p className={`font-medium ${selectedPaper.quantity <= (selectedPaper.reorder_level || 0) ? 'text-red-600' : 'text-gray-900'}`}>
                                    {selectedPaper.quantity} {selectedPaper.unit}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Quantity Needed</label>
                        <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400"
                            placeholder="e.g. 1000"
                        />
                    </div>

                    {/* Ups per sheet */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ups per Sheet</label>
                        <input
                            type="number"
                            min={1}
                            value={upsPerSheet}
                            onChange={(e) => setUpsPerSheet(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400"
                            placeholder="e.g. 4"
                        />
                        <p className="text-xs text-gray-500 mt-1">Number of pieces that fit on one sheet</p>
                    </div>
                </div>

                {/* Result Section */}
                <div className="space-y-4">
                    {/* Main Cost Card */}
                    <div className="bg-white rounded-lg border border-gray-100 p-6">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-5">
                            <IndianRupee className="w-5 h-5 text-gray-400" />
                            Cost Breakdown
                        </h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-gray-600">Sheets Needed</span>
                                <span className="font-bold text-gray-900 text-lg">{sheetsNeeded.toLocaleString('en-IN')}</span>
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div>
                                    <span className="text-gray-600">Cost per Sheet</span>
                                    <p className="text-xs text-gray-400">From {selectedPaper?.name || 'paper stock'}</p>
                                </div>
                                <span className="font-medium text-gray-900">{formatCurrency(selectedPaper?.cost_per_unit || 0)}</span>
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-gray-600">Total Paper Cost</span>
                                <span className="font-bold text-gray-900 text-xl">{formatCurrency(paperCost)}</span>
                            </div>

                            <div className="flex items-center justify-between py-3 bg-gray-50 px-4 -mx-2 rounded-lg">
                                <span className="text-gray-700 font-medium">Cost per Piece</span>
                                <span className="font-bold text-primary text-xl">{formatCurrency(costPerPiece)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stock Warning */}
                    {selectedPaper && sheetsNeeded > selectedPaper.quantity && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <Package className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-800">Insufficient Stock</p>
                                <p className="text-xs text-red-600 mt-0.5">
                                    Need {sheetsNeeded.toLocaleString('en-IN')} sheets but only {selectedPaper.quantity.toLocaleString('en-IN')} in stock.
                                    You need {(sheetsNeeded - selectedPaper.quantity).toLocaleString('en-IN')} more sheets.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Formula Reference */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500">
                        <p className="font-semibold text-gray-700 mb-2">Formula:</p>
                        <ul className="space-y-1">
                            <li>• Sheets = ⌈ Quantity ÷ Ups per Sheet ⌉</li>
                            <li>• Paper Cost = Sheets × Cost per Sheet</li>
                            <li>• Cost per Piece = Paper Cost ÷ Quantity</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
