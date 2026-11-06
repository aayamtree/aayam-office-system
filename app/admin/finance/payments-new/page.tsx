'use client';

/** Trial: Payments. Runs the live payments screen on the TEST COPY of the data. */
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import Payments from '../payments/page';

export default function PaymentsNewPage() { return (<AdminOnlyGate><Payments /></AdminOnlyGate>); }
