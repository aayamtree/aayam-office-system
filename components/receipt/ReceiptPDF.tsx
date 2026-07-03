'use client';

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

// Styles for thermal receipt (80mm width)
const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    width: 226, // ~80mm at 72 DPI
  },
  header: {
    textAlign: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px dashed #000',
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  companyDetails: {
    fontSize: 7,
    color: '#444',
    lineHeight: 1.4,
  },
  receiptTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    fontSize: 8,
  },
  divider: {
    borderBottom: '1px dashed #000',
    marginVertical: 5,
  },
  table: {
    marginVertical: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1px solid #000',
    paddingBottom: 3,
    marginBottom: 3,
    fontWeight: 'bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    marginBottom: 2,
    fontSize: 8,
  },
  colItem: { width: '50%' },
  colQty: { width: '15%', textAlign: 'center' },
  colRate: { width: '15%', textAlign: 'right' },
  colAmount: { width: '20%', textAlign: 'right' },
  totalsSection: {
    marginTop: 5,
    paddingTop: 5,
    borderTop: '1px dashed #000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    fontSize: 8,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
    paddingTop: 3,
    borderTop: '1px solid #000',
    fontWeight: 'bold',
    fontSize: 10,
  },
  paymentInfo: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#f5f5f5',
    fontSize: 8,
  },
  footer: {
    marginTop: 10,
    paddingTop: 5,
    borderTop: '1px dashed #000',
    textAlign: 'center',
    fontSize: 8,
  },
  thankYou: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
  },
});

// Receipt Data Interface
export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  // Company
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  
  // Receipt Info
  receiptNumber: string;
  date: string;
  time: string;
  
  // Customer
  customerName?: string;
  customerPhone?: string;
  
  // Items
  items: ReceiptItem[];
  
  // Amounts
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  gstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  gstin?: string;
  grandTotal: number;
  
  // Payment
  paymentMode: string;
  amountReceived: number;
  change: number;
  
  // Cashier
  cashier: string;
}

// Receipt PDF Document
export const ReceiptPDF = ({ data }: { data: ReceiptData }) => (
  <Document>
    <Page size={[226, 'auto']} style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.companyName}>{data.companyName}</Text>
        <Text style={styles.companyDetails}>
          {data.companyAddress}{'\n'}
          Ph: {data.companyPhone}
        </Text>
      </View>
      
      {/* Document Title */}
      <Text style={styles.receiptTitle}>ESTIMATE</Text>

      {/* Estimate Info */}
      <View style={styles.infoRow}>
        <Text>Estimate #: {data.receiptNumber}</Text>
        <Text>{data.date}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text>Time: {data.time}</Text>
        <Text>Cashier: {data.cashier}</Text>
      </View>
      
      {/* Customer Info */}
      {data.customerName && (
        <View style={styles.infoRow}>
          <Text>Customer: {data.customerName}</Text>
          {data.customerPhone && <Text>{data.customerPhone}</Text>}
        </View>
      )}
      <View style={styles.divider} />
      
      {/* Items Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.colItem}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amt</Text>
        </View>
        
        {/* Table Rows */}
        {data.items.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.colItem}>{item.name}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colRate}>Rs.{item.price}</Text>
            <Text style={styles.colAmount}>Rs.{item.total}</Text>
          </View>
        ))}
      </View>
      
      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text>Subtotal:</Text>
          <Text>Rs.{data.subtotal.toFixed(2)}</Text>
        </View>
        {data.discountAmount > 0 && (
          <View style={styles.totalRow}>
            <Text>Discount ({data.discountPercent}%):</Text>
            <Text>-Rs.{data.discountAmount.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.grandTotal}>
          <Text>TOTAL:</Text>
          <Text>Rs.{data.grandTotal.toFixed(2)}</Text>
        </View>
      </View>
      
      {/* Payment Info */}
      <View style={styles.paymentInfo}>
        <View style={styles.totalRow}>
          <Text>Payment Mode:</Text>
          <Text>{data.paymentMode.toUpperCase()}</Text>
        </View>
        {data.paymentMode === 'cash' && (
          <>
            <View style={styles.totalRow}>
              <Text>Amount Received:</Text>
              <Text>Rs.{data.amountReceived.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Change:</Text>
              <Text>Rs.{data.change.toFixed(2)}</Text>
            </View>
          </>
        )}
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.thankYou}>Thank You!</Text>
        <Text>Please visit again</Text>
        <Text style={{ marginTop: 5, fontSize: 7 }}>
          * Goods once sold will not be returned *
        </Text>
      </View>
    </Page>
  </Document>
);

// Export functions
export const downloadReceipt = async (data: ReceiptData) => {
  const blob = await pdf(<ReceiptPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Estimate-${data.receiptNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printReceipt = async (data: ReceiptData) => {
  const blob = await pdf(<ReceiptPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url);
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

// Default company data for receipts
export const defaultReceiptCompany = {
  companyName: 'aayam communication',
  companyAddress: 'ProPrintPack, Qtr. 92, Udhyog Nagar Colony, Rajkot 360002',
  companyPhone: '9537511100',
};
