import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { sendTelegramNotification } from '@/lib/telegram-service';
import { requireUser } from '@/lib/api-auth';

/**
 * Sends a payment receipt to the client's linked Telegram chat.
 * Body: { clientId, receiptNumber, amount, date, invoiceNumber?, mode?, reference?, balance? }
 */
export async function POST(req: NextRequest) {
  try {
    // Service-role route (bypasses RLS) — must verify the caller is a
    // logged-in staff member before sending anything to a client's Telegram.
    const gate = await requireUser();
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const { clientId, receiptNumber, amount, date, invoiceNumber, mode, reference, balance } = body || {};
    if (!clientId || !amount) {
      return NextResponse.json({ sent: false, error: 'Missing clientId or amount' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: client } = await supabase
      .from('clients')
      .select('name, company, telegram_chat_id')
      .eq('id', clientId)
      .single();

    if (!client) return NextResponse.json({ sent: false, error: 'Client not found' }, { status: 404 });
    if (!client.telegram_chat_id) {
      return NextResponse.json({ sent: false, reason: 'not_linked' });
    }

    const amt = Number(amount).toLocaleString('en-IN');
    const lines = [
      `<b>Payment Received — Receipt ${receiptNumber || ''}</b>`,
      `Dear ${client.company || client.name},`,
      ``,
      `We have received your payment of <b>₹${amt}</b>.`,
      date ? `Date: ${date}` : '',
      invoiceNumber ? `Against Invoice: ${invoiceNumber}` : '',
      mode ? `Mode: ${mode}` : '',
      reference ? `Reference: ${reference}` : '',
      (typeof balance === 'number' && balance > 0) ? `Balance remaining: ₹${Number(balance).toLocaleString('en-IN')}` : '',
      ``,
      `Thank you,`,
      `aayam communication`,
    ].filter(Boolean);

    const result = await sendTelegramNotification({
      chatId: String(client.telegram_chat_id),
      message: lines.join('\n'),
      parseMode: 'HTML',
    });

    if (!result.success) {
      return NextResponse.json({ sent: false, error: result.error || 'Telegram send failed' }, { status: 502 });
    }
    return NextResponse.json({ sent: true });
  } catch (err: any) {
    return NextResponse.json({ sent: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
