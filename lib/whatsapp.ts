// WhatsApp Share Utility Functions
// Uses wa.me link - 100% FREE, no API needed

/**
 * Opens WhatsApp with pre-filled message after confirmation
 * Shows phone number to user before sending
 */
export const shareOnWhatsApp = (phone: string, message: string, clientName?: string) => {
  // Remove any non-numeric characters from phone
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Add India country code if not present
  const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  
  // Format phone for display
  const displayPhone = cleanPhone.length === 10 
    ? `+91 ${cleanPhone.slice(0,5)} ${cleanPhone.slice(5)}`
    : `+${fullPhone}`;
  
  // Show confirmation with phone number
  const confirmMessage = clientName 
    ? `Send WhatsApp message to:\n\n👤 ${clientName}\n📱 ${displayPhone}\n\nClick OK to open WhatsApp`
    : `Send WhatsApp message to:\n\n📱 ${displayPhone}\n\nClick OK to open WhatsApp`;
  
  if (!confirm(confirmMessage)) {
    return; // User cancelled
  }
  
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Create WhatsApp URL
  const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
  
  // Open in new tab/window
  window.open(whatsappUrl, '_blank');
};

/**
 * Share without specific phone number (user selects contact)
 */
export const shareOnWhatsAppGeneric = (message: string) => {
  if (!confirm('Open WhatsApp to select a contact?\n\nClick OK to continue')) {
    return;
  }
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};

// =============================================
// MESSAGE TEMPLATES
// =============================================

interface InvoiceShareData {
  invoiceNumber: string;
  clientName: string;
  clientCompany: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  items: string;
}

export const getInvoiceMessage = (data: InvoiceShareData): string => {
  const balance = data.totalAmount - data.paidAmount;
  const status = balance === 0 ? '✅ PAID' : `⏳ Balance Due: Rs. ${balance.toLocaleString('en-IN')}`;
  
  return `📄 *INVOICE*

*${data.invoiceNumber}*
━━━━━━━━━━━━━━━
👤 *Client:* ${data.clientName}
🏢 *Company:* ${data.clientCompany}

📦 *Items:*
${data.items}

💰 *Total:* Rs. ${data.totalAmount.toLocaleString('en-IN')}
${status}
📅 *Due Date:* ${data.dueDate}
━━━━━━━━━━━━━━━

Thank you for your business! 🙏

*AAYAM CREATIVE*
📞 +91 98765 43210`;
};

interface JobShareData {
  jobNumber: string;
  projectName: string;
  clientName: string;
  clientCompany: string;
  status: string;
  quantity: number;
  totalAmount: number;
  deadline: string;
}

export const getJobStatusMessage = (data: JobShareData): string => {
  const statusEmoji: Record<string, string> = {
    'new': '🆕',
    'designing': '🎨',
    'approval': '👁️',
    'printing': '🖨️',
    'finishing': '✂️',
    'quality_check': '🔍',
    'ready': '✅',
    'dispatched': '🚚',
    'delivered': '📦',
  };
  
  return `📋 *JOB UPDATE*

*${data.jobNumber}*
━━━━━━━━━━━━━━━
📌 *Project:* ${data.projectName}
👤 *Client:* ${data.clientName}
🏢 *Company:* ${data.clientCompany}

${statusEmoji[data.status] || '📍'} *Status:* ${data.status.toUpperCase().replace('_', ' ')}
📦 *Quantity:* ${data.quantity}
💰 *Amount:* Rs. ${data.totalAmount.toLocaleString('en-IN')}
📅 *Deadline:* ${data.deadline}
━━━━━━━━━━━━━━━

*AAYAM CREATIVE*
📞 +91 98765 43210`;
};

interface DispatchShareData {
  dispatchNumber: string;
  jobNumber: string;
  clientName: string;
  clientCompany: string;
  status: string;
  transporterName?: string;
  vehicleNumber?: string;
  driverPhone?: string;
  trackingNumber?: string;
  expectedDelivery: string;
  deliveryAddress: string;
}

export const getDispatchMessage = (data: DispatchShareData): string => {
  const statusEmoji: Record<string, string> = {
    'pending': '⏳',
    'packed': '📦',
    'dispatched': '🚚',
    'in_transit': '🛣️',
    'delivered': '✅',
  };
  
  let trackingInfo = '';
  if (data.transporterName) trackingInfo += `\n🚛 *Transporter:* ${data.transporterName}`;
  if (data.vehicleNumber) trackingInfo += `\n🚗 *Vehicle:* ${data.vehicleNumber}`;
  if (data.driverPhone) trackingInfo += `\n📱 *Driver:* ${data.driverPhone}`;
  if (data.trackingNumber) trackingInfo += `\n🔢 *Tracking:* ${data.trackingNumber}`;
  
  return `🚚 *DISPATCH UPDATE*

*${data.dispatchNumber}*
━━━━━━━━━━━━━━━
📋 *Job:* ${data.jobNumber}
👤 *Client:* ${data.clientName}
🏢 *Company:* ${data.clientCompany}

${statusEmoji[data.status] || '📍'} *Status:* ${data.status.toUpperCase().replace('_', ' ')}
${trackingInfo}

📅 *Expected Delivery:* ${data.expectedDelivery}
📍 *Address:* ${data.deliveryAddress}
━━━━━━━━━━━━━━━

*AAYAM CREATIVE*
📞 +91 98765 43210`;
};

interface PaymentReminderData {
  invoiceNumber: string;
  clientName: string;
  clientCompany: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
}

export const getPaymentReminderMessage = (data: PaymentReminderData): string => {
  const balance = data.totalAmount - data.paidAmount;
  
  return `🔔 *PAYMENT REMINDER*

Dear ${data.clientName},

This is a friendly reminder for the pending payment.

📄 *Invoice:* ${data.invoiceNumber}
💰 *Total Amount:* Rs. ${data.totalAmount.toLocaleString('en-IN')}
✅ *Paid:* Rs. ${data.paidAmount.toLocaleString('en-IN')}
⏳ *Balance Due:* Rs. ${balance.toLocaleString('en-IN')}
📅 *Due Date:* ${data.dueDate}

Please make the payment at your earliest convenience.

Thank you! 🙏

*AAYAM CREATIVE*
📞 +91 98765 43210`;
};

interface QuoteShareData {
  quoteNumber: string;
  clientName: string;
  clientCompany: string;
  totalAmount: number;
  validUntil: string;
  items: string;
}

export const getQuotationMessage = (data: QuoteShareData): string => {
  return `📝 *QUOTATION*

*${data.quoteNumber}*
━━━━━━━━━━━━━━━
👤 *Client:* ${data.clientName}
🏢 *Company:* ${data.clientCompany}

📦 *Items:*
${data.items}

💰 *Total:* Rs. ${data.totalAmount.toLocaleString('en-IN')}
📅 *Valid Until:* ${data.validUntil}
━━━━━━━━━━━━━━━

Looking forward to your confirmation! 🙏

*AAYAM CREATIVE*
📞 +91 98765 43210`;
};
