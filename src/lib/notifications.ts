// This file will contain utilities and types for handling notifications.
// Future integrations: WhatsApp, e-mail, SMS.

export function sendNotification(type: string, message: string, recipient?: string) {
  console.log(`[Notification] Type: ${type}, Message: ${message}, Recipient: ${recipient || 'N/A'}`);
  // Placeholder for actual notification logic
}

export type NotificationType = 'new_appointment' | 'confirmation' | 'cancellation' | 'reschedule' | 'reminder';

// More types and functions will be added here as the notification system evolves.
