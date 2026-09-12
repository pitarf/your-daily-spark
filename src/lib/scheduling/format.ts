export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone: string) {
  return `${formatDate(iso, timeZone)} às ${formatTime(iso, timeZone)}`;
}

export function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayInTimezone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date());
}

/** Chave de calendário (YYYY-MM-DD) para um instante no fuso informado. */
export function dateKeyInTimezone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** Soma dias a uma data de calendário, preservando o fuso do estabelecimento. */
export function addDaysInTimezone(date: string, days: number, timeZone: string) {
  const baseNoon = new Date(`${date}T12:00:00Z`);
  const shifted = new Date(baseNoon.getTime() + days * 24 * 3600 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(shifted);
}

export function dayRangeUtc(date: string, timeZone: string) {
  // Usa o offset do fuso ao meio-dia para evitar bordas de horário de verão.
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const label = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = label?.replace("GMT", "") || "+00:00";
  const sign = offset.startsWith("-") ? "-" : "+";
  const normalized = offset.replace(/^[+-]/, "").padStart(5, "0");
  const iso = `${date}T00:00:00${sign}${normalized.includes(":") ? normalized : `${normalized}:00`}`;
  const start = new Date(iso);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
