// TO DO — payments to chase, receipts to check, cash to enter.
//
// These four lists come from lib/finance-todo.ts, which is also what the
// nightly reconcile cron sends to Telegram. That is the entire point: a count
// on this screen that disagrees with the count on your phone destroys trust in
// both, and neither gets acted on again.
//
// This page never matches anything. Matching writes, and a screen must not
// write to an inbox behind the reader's back — the cron does that on a schedule.

import { createServerSupabase } from '@/lib/supabase-server';
import { getFinanceTodo, type FinanceTodo } from '@/lib/finance-todo';
import ToDoClient from './ToDoClient';

export const revalidate = 0;

export default async function ToDoPage() {
    const supabase = createServerSupabase();
    const todo: FinanceTodo = await getFinanceTodo(supabase);
    return <ToDoClient todo={todo} />;
}
