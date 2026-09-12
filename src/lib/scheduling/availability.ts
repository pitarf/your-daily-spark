// Motor de disponibilidade do Marca Minha Vez.
// Puro (sem I/O): recebe a configuração de agenda + ocupações e devolve slots.

export type TimeRange = { start: string; end: string }; // "HH:MM"

export type WeeklyScheduleInput = {
  id: string;
  professional_id: string | null;
  weekday: number; // 0 = domingo
  start_time: string;
  end_time: string;
  active: boolean;
  breaks: TimeRange[];
};

export type ScheduleExceptionInput = {
  professional_id: string | null;
  date: string; // YYYY-MM-DD
  type: "closed" | "custom_hours";
  start_time: string | null;
  end_time: string | null;
};

export type BusyInterval = { startsAt: Date; endsAt: Date };

export type AvailabilityParams = {
  date: string; // YYYY-MM-DD
  timezone: string;
  serviceDurationMinutes: number;
  slotStepMinutes?: number;
  professionalId: string | null;
  schedules: WeeklyScheduleInput[];
  exceptions: ScheduleExceptionInput[];
  busy: BusyInterval[];
  now?: Date;
};

export type AvailabilitySlot = {
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
  label: string; // "HH:MM" no fuso do estabelecimento
  available: boolean;
};

export function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function toTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Converte uma data/hora local de um fuso em um instante UTC. */
export function zonedWallTimeToUtc(date: string, minutes: number, timeZone: string): Date {
  const [y = 1970, mo = 1, d = 1] = date.split("-").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0);
  let guess = new Date(asUtc);
  for (let i = 0; i < 2; i++) {
    const offset = timezoneOffsetMs(guess, timeZone);
    guess = new Date(asUtc - offset);
  }
  return guess;
}

function timezoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"] === "24" ? "0" : parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  return asUtc - instant.getTime();
}

export function weekdayOf(date: string, timeZone: string): number {
  const instant = zonedWallTimeToUtc(date, 12 * 60, timeZone);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Gera os slots do dia. Um serviço só entra se couber inteiro dentro da janela
 * de trabalho, fora dos intervalos e sem colidir com ocupações.
 *
 * Quando existe uma agenda específica para o profissional em determinado dia,
 * ela assume o lugar da agenda geral, inclusive quando estiver inativa. Isso
 * permite representar dias de folga individuais sem alterar o expediente do negócio.
 */
export function computeAvailability(params: AvailabilityParams): AvailabilitySlot[] {
  const {
    date,
    timezone,
    serviceDurationMinutes,
    slotStepMinutes = 15,
    professionalId,
    schedules,
    exceptions,
    busy,
    now = new Date(),
  } = params;

  if (!Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes <= 0) return [];

  const relevantExceptions = exceptions.filter(
    (e) => e.date === date && (e.professional_id === null || e.professional_id === professionalId),
  );
  if (relevantExceptions.some((e) => e.type === "closed")) return [];

  const weekday = weekdayOf(date, timezone);

  const daySchedules = schedules.filter((s) => s.weekday === weekday);
  const specificRows = professionalId
    ? daySchedules.filter((s) => s.professional_id === professionalId)
    : [];
  const generalRows = daySchedules.filter((s) => s.professional_id === null && s.active);

  // A existência de uma linha específica, mesmo inativa, é um override da agenda geral.
  const sourceRows = professionalId && specificRows.length > 0
    ? specificRows.filter((s) => s.active)
    : generalRows;

  let windows = sourceRows.map((s) => ({
    start: toMinutes(s.start_time),
    end: toMinutes(s.end_time),
    breaks: s.breaks.map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) })),
  }));

  // Uma exceção específica do profissional deve prevalecer sobre a exceção geral.
  const specificCustom = professionalId
    ? relevantExceptions.find(
        (e) => e.type === "custom_hours" && e.professional_id === professionalId && e.start_time && e.end_time,
      )
    : undefined;
  const generalCustom = relevantExceptions.find(
    (e) => e.type === "custom_hours" && e.professional_id === null && e.start_time && e.end_time,
  );
  const custom = specificCustom ?? generalCustom;

  if (custom) {
    windows = [
      { start: toMinutes(custom.start_time!), end: toMinutes(custom.end_time!), breaks: [] },
    ];
  }

  if (windows.length === 0) return [];

  const slots: AvailabilitySlot[] = [];

  for (const window of windows) {
    if (window.end <= window.start) continue;

    for (let start = window.start; start + serviceDurationMinutes <= window.end; start += slotStepMinutes) {
      const end = start + serviceDurationMinutes;

      const hitsBreak = window.breaks.some((b) => overlaps(start, end, b.start, b.end));
      const startsAt = zonedWallTimeToUtc(date, start, timezone);
      const endsAt = zonedWallTimeToUtc(date, end, timezone);
      const isPast = startsAt.getTime() <= now.getTime();
      const isBusy = busy.some((b) =>
        overlaps(startsAt.getTime(), endsAt.getTime(), b.startsAt.getTime(), b.endsAt.getTime()),
      );

      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        label: toTimeLabel(start),
        available: !hitsBreak && !isBusy && !isPast,
      });
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
