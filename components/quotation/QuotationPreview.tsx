'use client';

import { X, Printer, Download } from 'lucide-react';
import { downloadQuotationPDF, type QuotationData } from './QuotationPDF';

const inr = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

// Builds a clean, standalone HTML string of the quotation for printing.
function buildPrintHTML(d: QuotationData): string {
    const rows = (d.items || []).map((it, i) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">${i + 1}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;">${it.description ?? ''}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${it.quantity ?? ''}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${inr(it.rate)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">${inr(it.amount)}</td>
        </tr>`).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${d.quoteNumber}</title>
    <style>
      *{box-sizing:border-box;font-family:Helvetica,Arial,sans-serif;}
      body{margin:0;padding:32px;color:#1f2937;}
      .head{display:flex;justify-content:space-between;border-bottom:2px solid #4F46E5;padding-bottom:16px;margin-bottom:20px;}
      .cname{font-size:22px;font-weight:bold;color:#4F46E5;margin:0 0 4px;}
      .muted{color:#666;font-size:12px;line-height:1.5;}
      .title{font-size:28px;font-weight:bold;text-align:right;margin:0;}
      .qno{color:#4F46E5;text-align:right;margin-top:4px;font-size:13px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th{background:#4F46E5;color:#fff;padding:8px 10px;text-align:left;font-size:12px;}
      th.r,td.r{text-align:right;}
      .totals{margin-top:16px;margin-left:auto;width:280px;}
      .totals div{display:flex;justify-content:space-between;padding:4px 0;}
      .grand{border-top:2px solid #4F46E5;margin-top:6px;padding-top:8px;font-weight:bold;font-size:16px;color:#4F46E5;}
      .sec{margin-top:24px;}
      .sec h4{margin:0 0 4px;font-size:12px;text-transform:uppercase;color:#666;}
    </style></head><body>
      <div class="head">
        <div>
          <p class="cname">${d.companyName || ''}</p>
          <div class="muted">${d.companyAddress || ''}<br>${[d.companyCity, d.companyState, d.companyPincode].filter(Boolean).join(', ')}<br>${d.companyPhone || ''} · ${d.companyEmail || ''}</div>
        </div>
        <div>
          <p class="title">QUOTATION</p>
          <p class="qno">${d.quoteNumber}</p>
          <div class="muted" style="text-align:right;margin-top:6px;">Date: ${d.date}<br>Valid Until: ${d.validUntil}</div>
        </div>
      </div>
      <div class="muted"><strong style="color:#1f2937;">Bill To:</strong><br>
        <strong style="color:#1f2937;">${d.clientCompany || d.clientName}</strong><br>
        ${d.clientCompany ? d.clientName + '<br>' : ''}${d.clientAddress ? d.clientAddress + '<br>' : ''}${d.clientState ? d.clientState + '<br>' : ''}${d.clientPhone ? 'Ph: ' + d.clientPhone + '<br>' : ''}${d.clientGstin ? 'GSTIN: ' + d.clientGstin : ''}
      </div>
      <table>
        <thead><tr><th>#</th><th>Description</th><th style="text-align:center;">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals muted">
        <div><span>Subtotal</span><span>${inr(d.subtotal)}</span></div>
        <div><span>GST (${d.gstRate ?? 18}%)</span><span>${inr(d.taxAmount)}</span></div>
        <div class="grand"><span>Total</span><span>${inr(d.totalAmount)}</span></div>
      </div>
      ${d.terms ? `<div class="sec"><h4>Terms &amp; Conditions</h4><div class="muted">${d.terms}</div></div>` : ''}
      ${d.notes ? `<div class="sec"><h4>Notes</h4><div class="muted">${d.notes}</div></div>` : ''}
    </body></html>`;
}

export default function QuotationPreview({ data, onClose }: { data: QuotationData; onClose: () => void }) {
    const handlePrint = () => {
        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) return;
        w.document.write(buildPrintHTML(data));
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-lg max-w-3xl w-full my-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-lg">
                    <h3 className="font-semibold text-gray-900">Quotation {data.quoteNumber}</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                            <Printer size={15} /> Print
                        </button>
                        <button onClick={() => downloadQuotationPDF(data)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-colors">
                            <Download size={15} /> PDF
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md" title="Close">
                            <X size={18} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Document */}
                <div className="p-6 md:p-8">
                    <div className="flex justify-between border-b-2 border-indigo-600 pb-4 mb-5">
                        <div>
                            <p className="text-xl font-bold text-indigo-600">{data.companyName}</p>
                            <p className="text-xs text-gray-500 leading-relaxed mt-1">
                                {data.companyAddress}<br />
                                {[data.companyCity, data.companyState, data.companyPincode].filter(Boolean).join(', ')}<br />
                                {data.companyPhone} · {data.companyEmail}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-gray-800">QUOTATION</p>
                            <p className="text-indigo-600 text-sm mt-1">{data.quoteNumber}</p>
                            <p className="text-xs text-gray-500 mt-2">Date: {data.date}<br />Valid Until: {data.validUntil}</p>
                        </div>
                    </div>

                    <div className="text-xs text-gray-600 mb-4">
                        <span className="font-semibold text-gray-900">Bill To:</span>
                        <p className="font-semibold text-gray-900 mt-1">{data.clientCompany || data.clientName}</p>
                        {data.clientCompany && <p>{data.clientName}</p>}
                        {data.clientAddress && <p>{data.clientAddress}</p>}
                        {data.clientState && <p>{data.clientState}</p>}
                        {data.clientPhone && <p>Ph: {data.clientPhone}</p>}
                        {data.clientGstin && <p>GSTIN: {data.clientGstin}</p>}
                    </div>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-indigo-600 text-white text-xs">
                                <th className="px-3 py-2 text-left">#</th>
                                <th className="px-3 py-2 text-left">Description</th>
                                <th className="px-3 py-2 text-center">Qty</th>
                                <th className="px-3 py-2 text-right">Rate</th>
                                <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items?.map((it, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                    <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                                    <td className="px-3 py-2 text-gray-900">{it.description}</td>
                                    <td className="px-3 py-2 text-center text-gray-600">{it.quantity}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{inr(it.rate)}</td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">{inr(it.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="ml-auto w-64 text-sm mt-4 text-gray-600">
                        <div className="flex justify-between py-1"><span>Subtotal</span><span>{inr(data.subtotal)}</span></div>
                        <div className="flex justify-between py-1"><span>GST ({data.gstRate ?? 18}%)</span><span>{inr(data.taxAmount)}</span></div>
                        <div className="flex justify-between pt-2 mt-1 border-t-2 border-indigo-600 font-bold text-base text-indigo-600">
                            <span>Total</span><span>{inr(data.totalAmount)}</span>
                        </div>
                    </div>

                    {data.terms && (
                        <div className="mt-6">
                            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Terms &amp; Conditions</h4>
                            <p className="text-xs text-gray-600 whitespace-pre-line">{data.terms}</p>
                        </div>
                    )}
                    {data.notes && (
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Notes</h4>
                            <p className="text-xs text-gray-600 whitespace-pre-line">{data.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
