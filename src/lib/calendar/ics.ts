export type CalendarEvent = {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string | null;
};

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatUtc(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data inválida para o evento.");
  return parsed.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createIcsContent(event: CalendarEvent) {
  const description = event.description ? `DESCRIPTION:${escapeIcsText(event.description)}\r\n` : "";
  const location = event.location ? `LOCATION:${escapeIcsText(event.location)}\r\n` : "";
  const uid = `${formatUtc(event.start)}-${Math.random().toString(36).slice(2)}@marcaminhavez`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marca Minha Vez//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUtc(new Date().toISOString())}`,
    `DTSTART:${formatUtc(event.start)}`,
    `DTEND:${formatUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    description.trimEnd(),
    location.trimEnd(),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n") + "\r\n";
}

export function calendarDataUrl(event: CalendarEvent) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(createIcsContent(event))}`;
}
