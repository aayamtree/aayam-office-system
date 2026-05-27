/**
 * Unified Notification Service
 * Sends notifications to BOTH Telegram AND in-app simultaneously
 */

import { supabase } from './supabase';
import { sendTelegramNotification } from './telegram-service';

export type NotificationType = 
  | 'job_assigned'
  | 'qc_ready'
  | 'payment_received'
  | 'followup_reminder'
  | 'job_completed'
  | 'approval_required'
  | 'deadline_approaching'
  | 'system_alert';

export interface NotificationData {
  userId: string; // User to notify
  title: string;
  message: string;
  type: NotificationType;
  priority?: 'normal' | 'high' | 'urgent';
  entityType?: string; // 'job', 'payment', 'lead', etc.
  entityId?: string;
  actionUrl?: string; // Where to go when clicked
  icon?: string; // Emoji
}

/**
 * Send notification to BOTH Telegram and In-App
 */
export async function sendDualNotification(data: NotificationData) {
  const results = {
    inApp: false,
    telegram: false,
    errors: [] as string[]
  };

  try {
    // 1. Save to in-app notifications table
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert([{
        user_id: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || 'normal',
        entity_type: data.entityType,
        entity_id: data.entityId,
        action_url: data.actionUrl,
        icon: data.icon || '🔔',
      }])
      .select()
      .single();

    if (dbError) {
      results.errors.push(`In-app: ${dbError.message}`);
    } else {
      results.inApp = true;
    }

    // 2. Send to Telegram (if user has Telegram linked)
    const { data: telegramData } = await supabase
      .from('user_telegram')
      .select('telegram_chat_id, is_active')
      .eq('user_id', data.userId)
      .eq('is_active', true)
      .single();

    if (telegramData?.telegram_chat_id) {
      // Format message with icon
      const telegramMessage = `${data.icon || '🔔'} <b>${data.title}</b>\n\n${data.message}`;
      
      const telegramResult = await sendTelegramNotification({
        chatId: telegramData.telegram_chat_id,
        message: telegramMessage,
        parseMode: 'HTML',
      });

      if (telegramResult.success) {
        results.telegram = true;
        
        // Update notification with Telegram message ID
        if (notification?.id) {
          await supabase
            .from('notifications')
            .update({
              sent_to_telegram: true,
              telegram_message_id: (telegramResult.data as any)?.result?.message_id?.toString(),
              telegram_sent_at: new Date().toISOString(),
            })
            .eq('id', notification.id);
        }
      } else {
        results.errors.push(`Telegram: ${telegramResult.error}`);
      }
    }

    return results;
  } catch (error) {
    results.errors.push(`System: ${error}`);
    return results;
  }
}

/**
 * Send notification to multiple users
 */
export async function sendBulkDualNotification(
  userIds: string[],
  data: Omit<NotificationData, 'userId'>
) {
  const results = await Promise.allSettled(
    userIds.map(userId =>
      sendDualNotification({ ...data, userId })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { successful, failed, total: userIds.length };
}

/**
 * Notify based on user role
 */
export async function notifyByRole(
  role: string | string[],
  data: Omit<NotificationData, 'userId'>
) {
  const roles = Array.isArray(role) ? role : [role];
  
  // Get all users with specified role(s)
  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .in('role', roles)
    .eq('is_active', true);

  if (!users || users.length === 0) {
    return { successful: 0, failed: 0, total: 0 };
  }

  const userIds = users.map(u => u.id);
  return sendBulkDualNotification(userIds, data);
}

// =====================================================
// PRESET NOTIFICATION TEMPLATES
// =====================================================

/**
 * Notify when job is assigned to designer
 */
export async function notifyJobAssigned(userId: string, job: any) {
  return sendDualNotification({
    userId,
    title: 'New Job Assigned',
    message: `Job #${job.job_number}: ${job.project_name} for ${job.client?.name || 'client'}. Deadline: ${new Date(job.client_deadline).toLocaleDateString('en-IN')}`,
    type: 'job_assigned',
    priority: job.priority === 'urgent' ? 'urgent' : 'normal',
    entityType: 'job',
    entityId: job.id,
    actionUrl: `/admin/jobs/${job.id}`,
    icon: '🎨',
  });
}

/**
 * Notify dispatch when job ready for QC
 */
export async function notifyQCReady(job: any) {
  return notifyByRole('dispatch', {
    title: 'QC Ready',
    message: `Job #${job.job_number}: ${job.project_name}. Quantity: ${job.quantity || 0}. Client: ${job.client?.name || 'N/A'}`,
    type: 'qc_ready',
    priority: 'high',
    entityType: 'job',
    entityId: job.id,
    actionUrl: `/admin/dispatch/qc-check`,
    icon: '📦',
  });
}

/**
 * Notify finance when payment received
 */
export async function notifyPaymentReceived(payment: any) {
  return notifyByRole(['finance', 'admin'], {
    title: 'Payment Received',
    message: `₹${payment.amount.toLocaleString('en-IN')} from ${payment.client_name || 'client'} via ${payment.payment_mode}`,
    type: 'payment_received',
    priority: 'normal',
    entityType: 'payment',
    entityId: payment.id,
    actionUrl: `/admin/finance/payments`,
    icon: '💰',
  });
}

/**
 * Notify marketing about follow-up reminder
 */
export async function notifyFollowUpReminder(userId: string, lead: any) {
  return sendDualNotification({
    userId,
    title: 'Follow-up Reminder',
    message: `Follow up with ${lead.name} (${lead.phone || 'No phone'}). Interest: ${lead.product_interest || 'N/A'}`,
    type: 'followup_reminder',
    priority: 'normal',
    entityType: 'lead',
    entityId: lead.id,
    actionUrl: `/admin/marketing/leads`,
    icon: '📞',
  });
}

/**
 * Notify about approaching deadline
 */
export async function notifyDeadlineApproaching(userId: string, job: any, daysLeft: number) {
  return sendDualNotification({
    userId,
    title: `Deadline Alert: ${daysLeft} days left`,
    message: `Job #${job.job_number}: ${job.project_name}. Deadline: ${new Date(job.client_deadline).toLocaleDateString('en-IN')}`,
    type: 'deadline_approaching',
    priority: daysLeft <= 1 ? 'urgent' : 'high',
    entityType: 'job',
    entityId: job.id,
    actionUrl: `/admin/jobs/${job.id}`,
    icon: '⏰',
  });
}

/**
 * System alert (admin only)
 */
export async function sendSystemAlert(message: string, priority: 'normal' | 'high' | 'urgent' = 'high') {
  return notifyByRole('admin', {
    title: 'System Alert',
    message,
    type: 'system_alert',
    priority,
    icon: '⚠️',
  });
}
