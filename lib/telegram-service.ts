/**
 * Telegram Notification Service
 * Sends notifications to staff via Telegram bot
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface TelegramNotification {
  chatId: string; // User's Telegram chat ID
  message: string;
  parseMode?: 'HTML' | 'Markdown';
  buttons?: Array<{ text: string; callback_data: string }>;
}

/**
 * Send notification to a specific user
 */
export async function sendTelegramNotification(data: TelegramNotification) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram bot token not configured');
    return { success: false, error: 'Bot token not configured' };
  }

  try {
    const payload: any = {
      chat_id: data.chatId,
      text: data.message,
      parse_mode: data.parseMode || 'HTML',
    };

    // Add inline buttons if provided
    if (data.buttons && data.buttons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: [
          data.buttons.map(btn => ({
            text: btn.text,
            callback_data: btn.callback_data
          }))
        ]
      };
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram API error:', result);
      return { success: false, error: result.description };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send notification to multiple users
 */
export async function sendBulkTelegramNotifications(
  chatIds: string[],
  message: string,
  parseMode?: 'HTML' | 'Markdown'
) {
  const results = await Promise.allSettled(
    chatIds.map(chatId =>
      sendTelegramNotification({ chatId, message, parseMode })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { successful, failed, total: chatIds.length };
}

/**
 * Format job notification for Telegram
 */
export function formatJobNotification(job: any) {
  return `
🔔 <b>New Job Assignment</b>

📋 <b>Job:</b> #${job.job_number}
👤 <b>Client:</b> ${job.client?.name || 'N/A'}
📦 <b>Product:</b> ${job.project_name}
📅 <b>Deadline:</b> ${new Date(job.client_deadline).toLocaleDateString('en-IN')}
⚡ <b>Priority:</b> ${job.priority?.toUpperCase()}

<i>Check the app for details</i>
  `.trim();
}

/**
 * Format QC notification for dispatch
 */
export function formatQCNotification(job: any) {
  return `
📦 <b>QC Ready</b>

📋 <b>Job:</b> #${job.job_number}
👤 <b>Client:</b> ${job.client?.name || 'N/A'}
📦 <b>Product:</b> ${job.project_name}
🔢 <b>Quantity:</b> ${job.quantity || 0}

✅ Open app to perform quality check
  `.trim();
}

/**
 * Format payment notification
 */
export function formatPaymentNotification(payment: any) {
  return `
💰 <b>Payment Received</b>

💵 <b>Amount:</b> ₹${payment.amount.toLocaleString('en-IN')}
👤 <b>From:</b> ${payment.client_name || 'N/A'}
📋 <b>Invoice:</b> #${payment.invoice_number || 'N/A'}
💳 <b>Mode:</b> ${payment.payment_mode}

<i>Updated in Finance</i>
  `.trim();
}

/**
 * Format follow-up reminder
 */
export function formatFollowUpReminder(lead: any) {
  return `
📞 <b>Follow-up Reminder</b>

👤 <b>Lead:</b> ${lead.name}
📱 <b>Phone:</b> ${lead.phone || 'N/A'}
🎯 <b>Interest:</b> ${lead.product_interest || 'N/A'}

<i>Follow up today!</i>
  `.trim();
}
