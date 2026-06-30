'use client';

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

export interface StatementRow {
  date: string;
  billNo: string;
  particulars: string;
  taxable: number;
  gst: number;
  total: number;
  status: string;
  balance: number;
}

export interface StatementData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyGstin?: string;
  clientName: string;
  clientPhone?: string;
  clientGstin?: string;
  clientAddress?: string;
  periodLabel: string;       // e.g. "June 2026"
  generatedOn: string;
  rows: StatementRow[];
  totalTaxable: number;
  totalGst: number;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  openingBalance: number;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  companyName: { fontSize: 16, fontWeight: 'bold' },
  small: { fontSize: 8, color: '#555', lineHeight: 1.4 },
  title: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 2 },
  period: { fontSize: 9, textAlign: 'center', color: '#555', marginBottom: 10 },
  divider: { borderBottom: '1px solid #333', marginVertical: 6 },
  partyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  partyBox: { width: '48%' },
  label: { fontSize: 7, color: '#888', textTransform: 'uppercase', marginBottom: 1 },
  bold: { fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderTop: '1px solid #333', borderBottom: '1px solid #333', paddingVertical: 4, fontWeight: 'bold', fontSize: 8 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottom: '1px solid #e5e5e5', fontSize: 8 },
  cDate: { width: '13%' },
  cBill: { width: '17%' },
  cPart: { width: '26%' },
  cTax: { width: '13%', textAlign: 'right' },
  cGst: { width: '11%', textAlign: 'right' },
  cTot: { width: '12%', textAlign: 'right' },
  cStat: { width: '8%', textAlign: 'right' },
  totalsRow: { flexDirection: 'row', paddingVertical: 4, borderTop: '1px solid #333', fontWeight: 'bold', fontSize: 9 },
  summary: { marginTop: 14, alignSelf: 'flex-end', width: '50%' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  sumTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTop: '1px solid #333', borderBottom: '2px solid #333', fontWeight: 'bold', fontSize: 11 },
  footer: { marginTop: 24, fontSize: 7, color: '#888', textAlign: 'center' },
});

const rs = (n: number) => 'Rs.' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const StatementPDF = ({ data }: { data: StatementData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.small}>{data.companyAddress}</Text>
          <Text style={styles.small}>Ph: {data.companyPhone}{data.companyGstin ? `  |  GSTIN: ${data.companyGstin}` : ''}</Text>
        </View>
      </View>

      <Text style={styles.title}>MONTHLY PRINT STATEMENT</Text>
      <Text style={styles.period}>{data.periodLabel}</Text>

      <View style={styles.partyRow}>
        <View style={styles.partyBox}>
          <Text style={styles.label}>Billed To</Text>
          <Text style={styles.bold}>{data.clientName}</Text>
          {data.clientAddress ? <Text style={styles.small}>{data.clientAddress}</Text> : null}
          {data.clientPhone ? <Text style={styles.small}>Ph: {data.clientPhone}</Text> : null}
          {data.clientGstin ? <Text style={styles.small}>GSTIN: {data.clientGstin}</Text> : null}
        </View>
        <View style={[styles.partyBox, { alignItems: 'flex-end' }]}>
          <Text style={styles.label}>Statement Date</Text>
          <Text style={styles.bold}>{data.generatedOn}</Text>
          <Text style={[styles.label, { marginTop: 4 }]}>Bills in Period</Text>
          <Text style={styles.bold}>{data.rows.length}</Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.cDate}>Date</Text>
        <Text style={styles.cBill}>Bill #</Text>
        <Text style={styles.cPart}>Particulars</Text>
        <Text style={styles.cTax}>Taxable</Text>
        <Text style={styles.cGst}>GST</Text>
        <Text style={styles.cTot}>Total</Text>
        <Text style={styles.cStat}>Status</Text>
      </View>

      {data.rows.map((r, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.cDate}>{r.date}</Text>
          <Text style={styles.cBill}>{r.billNo}</Text>
          <Text style={styles.cPart}>{r.particulars}</Text>
          <Text style={styles.cTax}>{rs(r.taxable)}</Text>
          <Text style={styles.cGst}>{rs(r.gst)}</Text>
          <Text style={styles.cTot}>{rs(r.total)}</Text>
          <Text style={styles.cStat}>{r.status}</Text>
        </View>
      ))}

      <View style={styles.totalsRow}>
        <Text style={styles.cDate}></Text>
        <Text style={styles.cBill}></Text>
        <Text style={styles.cPart}>TOTAL</Text>
        <Text style={styles.cTax}>{rs(data.totalTaxable)}</Text>
        <Text style={styles.cGst}>{rs(data.totalGst)}</Text>
        <Text style={styles.cTot}>{rs(data.totalBilled)}</Text>
        <Text style={styles.cStat}></Text>
      </View>

      <View style={styles.summary}>
        {data.openingBalance ? (
          <View style={styles.sumRow}><Text>Opening Balance</Text><Text>{rs(data.openingBalance)}</Text></View>
        ) : null}
        <View style={styles.sumRow}><Text>Total Billed (this month)</Text><Text>{rs(data.totalBilled)}</Text></View>
        <View style={styles.sumRow}><Text>Total GST</Text><Text>{rs(data.totalGst)}</Text></View>
        <View style={styles.sumRow}><Text>Paid / Received</Text><Text>{rs(data.totalPaid)}</Text></View>
        <View style={styles.sumTotal}><Text>Amount Due</Text><Text>{rs(data.totalOutstanding + data.openingBalance)}</Text></View>
      </View>

      <Text style={styles.footer}>
        This is a computer-generated statement. {data.companyName} — generated on {data.generatedOn}.
      </Text>
    </Page>
  </Document>
);

const fileName = (data: StatementData) =>
  `Statement-${data.clientName.replace(/[^a-z0-9]/gi, '_')}-${data.periodLabel.replace(/\s+/g, '_')}.pdf`;

export const downloadStatement = async (data: StatementData) => {
  const blob = await pdf(<StatementPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(data);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const printStatement = async (data: StatementData) => {
  const blob = await pdf(<StatementPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) w.onload = () => w.print();
};
