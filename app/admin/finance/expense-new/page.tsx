'use client';

/** Trial: Record expense. Runs the live quick-expense screen on the TEST COPY of the data. */
import AdminOnlyGate from '@/components/finance/AdminOnlyGate';
import QuickExpense from '../expenses/quick/page';

export default function ExpenseNewPage() { return (<AdminOnlyGate><QuickExpense /></AdminOnlyGate>); }
