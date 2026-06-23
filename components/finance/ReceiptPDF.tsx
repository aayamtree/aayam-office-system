/* Payment Receipt voucher — mirrors InvoicePDF style, used for Download/Print */
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { defaultCompanyData } from '@/components/invoice/InvoicePDF';

export interface ReceiptData {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerCompany?: string;
  amount: number;
  amountWords: string;
  invoiceNumber?: string;
  mode?: string;
  reference?: string;
  balanceRemaining?: number;
  // company (defaults applied by helper)
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyPincode: string;
  companyPhone: string;
  companyEmail: string;
  companyGstin: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', color: '#111827' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  company: { fontSize: 14, fontWeight: 'bold' },
  muted: { color: '#6b7280', fontSize: 9, marginTop: 2 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  badge: { marginTop: 4, fontSize: 9, color: '#047857' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#6b7280', fontSize: 10 },
  value: { fontSize: 11, fontWeight: 'bold' },
  amountBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 6, padding: 14, marginVertical: 16 },
  amountLabel: { fontSize: 9, color: '#15803d', textTransform: 'uppercase' },
  amountValue: { fontSize: 24, fontWeight: 'bold', color: '#166534', marginTop: 2 },
  words: { fontSize: 10, color: '#374151', marginTop: 6, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  signLine: { fontSize: 9, color: '#6b7280', borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 4, width: 150, textAlign: 'center' },
});

export const ReceiptPDF = ({ data }: { data: ReceiptData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.company}>{data.companyName}</Text>
          <Text style={styles.muted}>{data.companyAddress}</Text>
          <Text style={styles.muted}>{data.companyCity}, {data.companyState} - {data.companyPincode}</Text>
          <Text style={styles.muted}>Phone: {data.companyPhone}  |  GSTIN: {data.companyGstin}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>RECEIPT</Text>
          <Text style={styles.badge}>Payment Received</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Receipt No.</Text><Text style={styles.value}>{data.receiptNumber}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Date</Text><Text style={styles.value}>{data.date}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Received From</Text>
        <Text style={styles.value}>{data.customerCompany || data.customerName}</Text>
      </View>
      {data.invoiceNumber ? (
        <View style={styles.row}><Text style={styles.label}>Against Invoice</Text><Text style={styles.value}>{data.invoiceNumber}</Text></View>
      ) : null}
      {data.mode ? (
        <View style={styles.row}><Text style={styles.label}>Payment Mode</Text><Text style={styles.value}>{data.mode}</Text></View>
      ) : null}
      {data.reference ? (
        <View style={styles.row}><Text style={styles.label}>Reference</Text><Text style={styles.value}>{data.reference}</Text></View>
      ) : null}

      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Amount Received</Text>
        <Text style={styles.amountValue}>{'₹'} {data.amount.toLocaleString('en-IN')}</Text>
        <Text style={styles.words}>{data.amountWords}</Text>
      </View>

      {typeof data.balanceRemaining === 'number' ? (
        <View style={styles.row}>
          <Text style={styles.label}>Balance Remaining on Invoice</Text>
          <Text style={styles.value}>{'₹'} {Math.max(0, data.balanceRemaining).toLocaleString('en-IN')}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.muted}>This is a computer-generated receipt.</Text>
        <Text style={styles.signLine}>Authorized Signatory</Text>
      </View>
    </Page>
  </Document>
);

// ── Indian number to words ──
export function amountInWords(num: number): string {
  num = Math.round(num);
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number): string => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
  const three = (n: number): string => {
    const h = Math.floor(n / 100); const r = n % 100;
    return (h ? a[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
  };
  let words = '';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const hundred = num;
  if (crore) words += two(crore) + ' Crore ';
  if (lakh) words += two(lakh) + ' Lakh ';
  if (thousand) words += two(thousand) + ' Thousand ';
  if (hundred) words += three(hundred);
  return words.trim() + ' Rupees Only';
}

export function buildReceiptData(payment: any, invoice: any, client: any): ReceiptData {
  const amount = Number(payment.amount || 0);
  return {
    ...defaultCompanyData,
    receiptNumber: payment.payment_number || 'RECEIPT',
    date: payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    customerName: client?.name || '',
    customerCompany: client?.company || client?.name || '',
    amount,
    amountWords: amountInWords(amount),
    invoiceNumber: invoice?.invoice_number,
    mode: (payment.payment_mode || '').replace('_', ' '),
    reference: payment.reference_number || undefined,
    balanceRemaining: invoice ? Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)) : undefined,
  };
}

export const downloadReceiptPDF = async (data: ReceiptData) => {
  const blob = await pdf(<ReceiptPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${data.receiptNumber}.pdf`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printReceiptPDF = async (data: ReceiptData) => {
  const blob = await pdf(<ReceiptPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) w.onload = () => w.print();
};
