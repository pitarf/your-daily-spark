export type BusinessHours = {
  start: string;
  end: string;
};

export type TimeRange = {
  start: string;
  end: string;
};

export type Booking = TimeRange & {
  id: string;
  professionalId: string;
};

export type BlockedSlot = TimeRange & {
  id: string;
  professionalId?: string;
};

export type AvailabilityInput = {
  date: Date;
  businessHours: BusinessHours;
  breaks?: TimeRange[];
  bookings?: Booking[];
  blockedSlots?: BlockedSlot[];
  professionalId?: string;
  serviceDurationMinutes: number;
  slotIntervalMinutes?: number;
};

export type AvailableSlot = {
  start: string;
  end: string;
};
