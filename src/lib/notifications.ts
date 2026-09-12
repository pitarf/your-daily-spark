export type NotificationType = "confirmation" | "cancellation" | "reminder";
export type NotificationStatus = "scheduled" | "sent" | "failed" | "cancelled";

export function notificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    confirmation: "Novo agendamento",
    cancellation: "Agendamento cancelado",
    reminder: "Lembrete de atendimento",
  };
  return labels[type] ?? "Notificação";
}

export function notificationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Agendada",
    sent: "Enviada",
    failed: "Falhou",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}
