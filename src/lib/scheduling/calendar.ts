import { addDaysInTimezone, dayRangeUtc } from "./format";

export type CalendarView = "day" | "week" | "month";

export function dateToCalendarParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/** Trabalha com datas civis via UTC para somar/subtrair dias sem depender do fuso local do navegador. */
export function addCalendarDays(date: string, days: number) {
  const { year, month, day } = dateToCalendarParts(date);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addCalendarMonths(date: string, months: number) {
  const { year, month, day } = dateToCalendarParts(date);
  const value = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0, 12)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function startOfWeekMonday(date: string) {
  const { year, month, day } = dateToCalendarParts(date);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  const sundayBasedDay = value.getUTCDay();
  const offset = sundayBasedDay === 0 ? -6 : 1 - sundayBasedDay;
  return addCalendarDays(date, offset);
}

export function daysInMonth(date: string) {
  const { year, month } = dateToCalendarParts(date);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthGridDates(date: string) {
  const first = `${date.slice(0, 7)}-01`;
  const { year, month } = dateToCalendarParts(first);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay();
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const cells = Math.ceil((leadingDays + daysInMonth(date)) / 7) * 7;
  const gridStart = addCalendarDays(first, -leadingDays);

  return Array.from({ length: cells }, (_, index) => addCalendarDays(gridStart, index));
}

export function periodDates(view: CalendarView, date: string, timeZone: string) {
  if (view === "day") return [date];
  if (view === "week") {
    const start = startOfWeekMonday(date);
    return Array.from({ length: 7 }, (_, index) => addDaysInTimezone(start, index, timeZone));
  }

  const days = daysInMonth(date);
  return Array.from({ length: days }, (_, index) =>
    addDaysInTimezone(`${date.slice(0, 7)}-01`, index, timeZone),
  );
}

export function periodRangeUtc(view: CalendarView, date: string, timeZone: string) {
  const dates = periodDates(view, date, timeZone);
  const first = dates[0] ?? date;
  const last = dates[dates.length - 1] ?? date;
  return {
    start: dayRangeUtc(first, timeZone).start,
    end: dayRangeUtc(addCalendarDays(last, 1), timeZone).start,
  };
}

export function dateKeyInTimezone(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
