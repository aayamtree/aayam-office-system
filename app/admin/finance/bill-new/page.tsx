'use client';

/** Trial: Enter bill. Runs the live vendor purchases screen on the TEST COPY of the data. */
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import VendorPurchases from '../vendors/purchases/page';

export default function BillNewPage() { return (<AdminOnlyGate><VendorPurchases /></AdminOnlyGate>); }
