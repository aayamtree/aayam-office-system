'use client';

import { Document, Page, Text, View, StyleSheet, Font, PDFDownloadLink, pdf } from '@react-pdf/renderer';

// Register fonts (using default for now)
// Font.register({ family: 'Roboto', src: '/fonts/Roboto-Regular.ttf' });

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2px solid #4F46E5',
  },
  companySection: {
    flex: 1,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: '#666666',
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#4F46E5',
    textAlign: 'right',
    marginTop: 5,
  },
  // Invoice Info & Client
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  infoBox: {
    width: '48%',
  },
  label: {
    fontSize: 8,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  value: {
    fontSize: 10,
    color: '#1F2937',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 3,
  },
  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    color: '#ffffff',
    padding: 10,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #E5E7EB',
    padding: 10,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  colSno: { width: '5%', textAlign: 'center' },
  colDesc: { width: '40%' },
  colHsn: { width: '12%', textAlign: 'center' },
  colQty: { width: '10%', textAlign: 'center' },
  colRate: { width: '15%', textAlign: 'right' },
  colAmount: { width: '18%', textAlign: 'right' },
  // Totals
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 25,
  },
  totalsBox: {
    width: '45%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottom: '1px solid #E5E7EB',
  },
  totalLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 10,
    color: '#1F2937',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#4F46E5',
    marginTop: 5,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // Amount in words
  amountWords: {
    backgroundColor: '#F3F4F6',
    padding: 10,
    marginBottom: 20,
    borderRadius: 4,
  },
  amountWordsLabel: {
    fontSize: 8,
    color: '#6B7280',
    marginBottom: 3,
  },
  amountWordsText: {
    fontSize: 10,
    color: '#1F2937',
    fontStyle: 'italic',
  },
  // Bank Details
  bankSection: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  bankBox: {
    width: '50%',
    padding: 15,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    borderBottom: '1px solid #E5E7EB',
    paddingBottom: 5,
  },
  bankDetail: {
    fontSize: 9,
    color: '#4B5563',
    marginBottom: 3,
  },
  termsBox: {
    width: '50%',
    paddingLeft: 20,
  },
  termsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  termsText: {
    fontSize: 8,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 15,
    borderTop: '1px solid #E5E7EB',
  },
  signatureBox: {
    textAlign: 'right',
  },
  signatureLine: {
    marginTop: 30,
    paddingTop: 5,
    borderTop: '1px solid #1F2937',
    fontSize: 9,
    color: '#6B7280',
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  // Watermark for paid
  paidWatermark: {
    position: 'absolute',
    top: '45%',
    left: '25%',
    fontSize: 60,
    color: '#22C55E',
    opacity: 0.15,
    transform: 'rotate(-30deg)',
    fontWeight: 'bold',
  },
});

// Helper: Number to words
function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = 'Rupees ' + convert(rupees);
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  result += ' Only';

  return result;
}

// Format currency
const formatCurrency = (amount: number) => {
  return 'Rs. ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Invoice Data Interface
export interface InvoiceItem {
  description: string;
  hsn?: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceData {
  // Company Details
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyPincode: string;
  companyPhone: string;
  companyEmail: string;
  companyGstin: string;

  // Invoice Details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;

  // Client Details
  clientName: string;
  clientCompany?: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientPincode: string;
  clientPhone: string;
  clientGstin?: string;

  // Items
  items: InvoiceItem[];

  // Amounts
  subtotal: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate?: number;
  igstAmount?: number;
  totalTax: number;
  discount: number;
  grandTotal: number;

  // Payment
  isPaid: boolean;

  // Bank Details
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;

  // Terms
  terms?: string;
  notes?: string;
}

// PDF Document Component
export const InvoicePDF = ({ data }: { data: InvoiceData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Paid Watermark */}
      {data.isPaid && <Text style={styles.paidWatermark}>PAID</Text>}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.companySection}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyDetails}>
            {data.companyAddress}{'\n'}
            {data.companyCity}, {data.companyState} - {data.companyPincode}{'\n'}
            Phone: {data.companyPhone} | Email: {data.companyEmail}{'\n'}
            GSTIN: {data.companyGstin}
          </Text>
        </View>
        <View>
          <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
          <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
        </View>
      </View>

      {/* Invoice Info & Client Details */}
      <View style={styles.infoSection}>
        <View style={styles.infoBox}>
          <Text style={styles.label}>Bill To</Text>
          <Text style={styles.clientName}>{data.clientName}</Text>
          {data.clientCompany && <Text style={styles.value}>{data.clientCompany}</Text>}
          <Text style={styles.companyDetails}>
            {data.clientAddress}{'\n'}
            {data.clientCity}, {data.clientState} - {data.clientPincode}{'\n'}
            Phone: {data.clientPhone}
            {data.clientGstin && `\nGSTIN: ${data.clientGstin}`}
          </Text>
        </View>
        <View style={styles.infoBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.label}>Invoice Date</Text>
              <Text style={styles.value}>{data.invoiceDate}</Text>
            </View>
            <View>
              <Text style={styles.label}>Due Date</Text>
              <Text style={styles.value}>{data.dueDate}</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Place of Supply</Text>
            <Text style={styles.value}>{data.clientState}</Text>
          </View>
        </View>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.colSno}>#</Text>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colHsn}>HSN/SAC</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {/* Table Rows */}
        {data.items.map((item, index) => (
          <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={styles.colSno}>{index + 1}</Text>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colHsn}>{item.hsn || '-'}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colRate}>{formatCurrency(item.rate)}</Text>
            <Text style={styles.colAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          {data.cgstAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>CGST ({data.cgstRate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.cgstAmount)}</Text>
            </View>
          )}
          {data.sgstAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>SGST ({data.sgstRate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.sgstAmount)}</Text>
            </View>
          )}
          {data.igstAmount && data.igstAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGST ({data.igstRate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.igstAmount)}</Text>
            </View>
          )}
          {data.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={[styles.totalValue, { color: '#22C55E' }]}>- {formatCurrency(data.discount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(data.grandTotal)}</Text>
          </View>
        </View>
      </View>

      {/* Amount in Words */}
      <View style={styles.amountWords}>
        <Text style={styles.amountWordsLabel}>Amount in Words</Text>
        <Text style={styles.amountWordsText}>{numberToWords(data.grandTotal)}</Text>
      </View>

      {/* Bank Details & Terms */}
      <View style={styles.bankSection}>
        <View style={styles.bankBox}>
          <Text style={styles.bankTitle}>Bank Details</Text>
          <Text style={styles.bankDetail}>Bank: {data.bankName}</Text>
          <Text style={styles.bankDetail}>A/C No: {data.bankAccount}</Text>
          <Text style={styles.bankDetail}>IFSC: {data.bankIfsc}</Text>
          <Text style={styles.bankDetail}>Branch: {data.bankBranch}</Text>
        </View>
        <View style={styles.termsBox}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>
            {data.terms || `1. Payment is due within the date mentioned above.\n2. Please include invoice number on your payment.\n3. Goods once sold will not be taken back.`}
          </Text>
          {data.notes && (
            <>
              <Text style={[styles.termsTitle, { marginTop: 10 }]}>Notes</Text>
              <Text style={styles.termsText}>{data.notes}</Text>
            </>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This is a computer generated invoice.
        </Text>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLine}>Authorized Signatory</Text>
          <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 5 }}>{data.companyName}</Text>
        </View>
      </View>
    </Page>
  </Document>
);

// Export helper functions
export const downloadInvoicePDF = async (data: InvoiceData) => {
  const blob = await pdf(<InvoicePDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printInvoicePDF = async (data: InvoiceData) => {
  const blob = await pdf(<InvoicePDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url);
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

// Default company data
export const defaultCompanyData = {
  companyName: 'AAYAM CREATIVE',
  companyAddress: '123 Business Hub, MG Road',
  companyCity: 'Rajkot',
  companyState: 'Gujarat',
  companyPincode: '360001',
  companyPhone: '+91 98765 43210',
  companyEmail: 'billing@aayam.com',
  companyGstin: '24XXXXX1234X1Z5',
  bankName: 'HDFC Bank',
  bankAccount: '50100012345678',
  bankIfsc: 'HDFC0001234',
  bankBranch: 'Rajkot Main Branch',
};
