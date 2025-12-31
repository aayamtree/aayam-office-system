'use client';

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';

// Styles (Reusing similar styles to Invoice for consistency)
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
    titleSection: {
        alignItems: 'flex-end',
    },
    docTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'right',
    },
    docNumber: {
        fontSize: 11,
        color: '#4F46E5',
        textAlign: 'right',
        marginTop: 5,
    },
    // Info & Client
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
    colDesc: { width: '50%' },
    colQty: { width: '10%', textAlign: 'center' },
    colRate: { width: '15%', textAlign: 'right' },
    colAmount: { width: '20%', textAlign: 'right' },
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
    // Terms
    termsSection: {
        marginTop: 20,
        paddingTop: 20,
        borderTop: '1px solid #E5E7EB',
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
});

// Format currency
const formatCurrency = (amount: number) => {
    return 'Rs. ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export interface QuotationItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface QuotationData {
    // Company Details
    companyName: string;
    companyAddress: string;
    companyCity: string;
    companyState: string;
    companyPincode: string;
    companyPhone: string;
    companyEmail: string;

    // Quote Details
    quoteNumber: string;
    date: string;
    validUntil: string;

    // Client Details
    clientName: string;
    clientCompany?: string;
    clientAddress?: string;
    clientPhone?: string;

    // Items
    items: QuotationItem[];

    // Amounts
    subtotal: number;
    taxAmount: number;
    totalAmount: number;

    // Terms
    terms?: string;
    notes?: string;
}

// PDF Document Component
export const QuotationPDF = ({ data }: { data: QuotationData }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.companySection}>
                    <Text style={styles.companyName}>{data.companyName}</Text>
                    <Text style={styles.companyDetails}>
                        {data.companyAddress}{'\n'}
                        {data.companyCity}, {data.companyState} - {data.companyPincode}{'\n'}
                        Phone: {data.companyPhone} | Email: {data.companyEmail}
                    </Text>
                </View>
                <View style={styles.titleSection}>
                    <Text style={styles.docTitle}>QUOTATION</Text>
                    <Text style={styles.docNumber}>{data.quoteNumber}</Text>
                </View>
            </View>

            {/* Info Section */}
            <View style={styles.infoSection}>
                <View style={styles.infoBox}>
                    <Text style={styles.label}>Quotation For</Text>
                    <Text style={styles.clientName}>{data.clientName}</Text>
                    {data.clientCompany && <Text style={styles.value}>{data.clientCompany}</Text>}
                    <Text style={styles.companyDetails}>
                        {data.clientAddress || ''}
                        {data.clientPhone ? `\nPhone: ${data.clientPhone}` : ''}
                    </Text>
                </View>
                <View style={styles.infoBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={styles.label}>Date</Text>
                            <Text style={styles.value}>{data.date}</Text>
                        </View>
                        <View>
                            <Text style={styles.label}>Valid Until</Text>
                            <Text style={styles.value}>{data.validUntil}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Items Table */}
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={styles.colSno}>#</Text>
                    <Text style={styles.colDesc}>Description</Text>
                    <Text style={styles.colQty}>Qty</Text>
                    <Text style={styles.colRate}>Rate</Text>
                    <Text style={styles.colAmount}>Amount</Text>
                </View>
                {data.items.map((item, index) => (
                    <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                        <Text style={styles.colSno}>{index + 1}</Text>
                        <Text style={styles.colDesc}>{item.description}</Text>
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
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>GST / Tax</Text>
                        <Text style={styles.totalValue}>{formatCurrency(data.taxAmount)}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                        <Text style={styles.grandTotalLabel}>Grand Total</Text>
                        <Text style={styles.grandTotalValue}>{formatCurrency(data.totalAmount)}</Text>
                    </View>
                </View>
            </View>

            {/* Terms */}
            <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>Terms & Conditions</Text>
                <Text style={styles.termsText}>
                    {data.terms || '1. This quotation is valid for 15 days.\n2. 50% advance payment required to confirm order.\n3. Delivery timeline starts after design approval.'}
                </Text>
                {data.notes && (
                    <>
                        <Text style={[styles.termsTitle, { marginTop: 10 }]}>Notes</Text>
                        <Text style={styles.termsText}>{data.notes}</Text>
                    </>
                )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Thank you for your business.
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
export const downloadQuotationPDF = async (data: QuotationData) => {
    const blob = await pdf(<QuotationPDF data={data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Quote_${data.quoteNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Default Company Data
export const defaultCompanyData = {
    companyName: 'AAYAM CREATIVE',
    companyAddress: '123 Business Hub, MG Road',
    companyCity: 'Rajkot',
    companyState: 'Gujarat',
    companyPincode: '360001',
    companyPhone: '+91 98765 43210',
    companyEmail: 'info@aayam.com',
};
