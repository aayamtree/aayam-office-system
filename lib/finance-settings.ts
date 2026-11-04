/**
 * Finance settings — stored as one JSON row in app_settings (key 'finance_settings').
 * Only admins can write (existing app_settings rule); finance staff can read.
 */
import { supabase } from '@/lib/supabase';
import { logFinance, diffFields } from '@/lib/finance-log';

export interface PaymentTerm { id: string; name: string; days: number }

export interface FinanceSettings {
    /** 'YYYY-MM-DD'. Nothing on or before this date may be added, changed or deleted. null = books open. */
    closingDate: string | null;
    paymentTerms: PaymentTerm[];
    invoiceMessage: string;
    firstInvoiceNumber: number | null;
    /** 1-12. Indian financial year starts in April = 4. */
    fiscalStartMonth: number;
    accountingMethod: 'accrual' | 'cash';
}

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
    closingDate: null,
    paymentTerms: [
        { id: 'due-on-receipt', name: 'Due on receipt', days: 0 },
        { id: 'net-15', name: 'Net 15', days: 15 },
        { id: 'net-30', name: 'Net 30', days: 30 },
        { id: 'net-45', name: 'Net 45', days: 45 },
    ],
    invoiceMessage: '',
    firstInvoiceNumber: null,
    fiscalStartMonth: 4,
    accountingMethod: 'accrual',
};

const KEY = 'finance_settings';

export async function loadFinanceSettings(): Promise<FinanceSettings> {
    const { data, error } = await supabase
        .from('app_settings').select('value').eq('key', KEY).maybeSingle();
    if (error || !data?.value) return DEFAULT_FINANCE_SETTINGS;
    try {
        return { ...DEFAULT_FINANCE_SETTINGS, ...JSON.parse(data.value) };
    } catch {
        return DEFAULT_FINANCE_SETTINGS;
    }
}

/** Saves, then writes the old -> new changes to the Finance log. Returns an error message or null. */
export async function saveFinanceSettings(
    next: FinanceSettings, prev: FinanceSettings, note?: string,
): Promise<string | null> {
    const { error } = await supabase.from('app_settings').upsert(
        { key: KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() },
        { onConflict: 'key' },
    );
    if (error) return error.message;
    const changes = diffFields(prev as any, next as any);
    if (changes.length) {
        await logFinance({
            action: 'edited', category: 'setting', entityType: 'finance_settings',
            entityLabel: 'Finance settings', changes, note,
        });
    }
    return null;
}

/**
 * Closing-date check. Call before saving/deleting/voiding anything dated `dateISO`.
 * Returns a message to show the user when the date is in a closed period, else null.
 * (Created in Step 1; each screen is wired to it when its step is built.)
 */
export function closedPeriodMessage(settings: FinanceSettings, dateISO: string | null | undefined): string | null {
    if (!settings.closingDate || !dateISO) return null;
    if (dateISO.slice(0, 10) <= settings.closingDate) {
        return `The books are closed up to ${settings.closingDate}. Reopen the books in Finance Settings to change this.`;
    }
    return null;
}
