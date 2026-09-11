import type {
  AvailabilityInput,
  AvailableSlot,
  Booking,
  BlockedSlot,
  TimeRange,
} from "./types";

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error(`Invalid time: ${value}`);
  }

  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function overlaps(start: number, end: number, range: TimeRange): boolean {
  const rangeStart = toMinutes(range.start);
  const rangeEnd = toMinutes(range.end);
  return start < rangeEnd && end > rangeStart;
}

function isRelevantBooking(
  booking: Booking,
  professionalId: string | undefined,
): boolean {
  return professionalId === undefined || booking.professionalId === professionalId;
}

function isRelevantBlock(
  block: BlockedSlot,
  professionalId: string | undefined,
): boolean {
  return block.professionalId === undefined || block.professionalId === professionalId;
}

export function getAvailableSlots({
  businessHours,
  breaks = [],
  bookings = [],
  blockedSlots = [],
  professionalId,
  serviceDurationMinutes,
  slotIntervalMinutes = serviceDurationMinutes,
}: AvailabilityInput): AvailableSlot[] {
  if (serviceDurationMinutes <= 0) {
    throw new Error("serviceDurationMinutes must be greater than zero");
  }

  if (slotIntervalMinutes <= 0) {
    throw new Error("slotIntervalMinutes must be greater than zero");
  }

  const opening = toMinutes(businessHours.start);
  const closing = toMinutes(businessHours.end);

  if (opening >= closing) {
    throw new Error("businessHours.start must be before businessHours.end");
  }

  const relevantBookings = bookings.filter((booking) =>
    isRelevantBooking(booking, professionalId),
  );
  const relevantBlocks = blockedSlots.filter((block) =>
    isRelevantBlock(block, professionalId),
  );

  const slots: AvailableSlot[] = [];

  for (
    let start = opening;
    start + serviceDurationMinutes <= closing;
    start += slotIntervalMinutes
  ) {
    const end = start + serviceDurationMinutes;
    const conflicts = [...breaks, ...relevantBookings, ...relevantBlocks].some(
      (range) => overlaps(start, end, range),
    );

    if (!conflicts) {
      slots.push({
        start: toTime(start),
        end: toTime(end),
      });
    }
  }

  return slots;
}
