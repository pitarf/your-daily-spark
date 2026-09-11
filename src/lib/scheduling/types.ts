export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type BusinessHours = {
  start: string;
  end: string;
};

export type TimeRange = {
  start: string;
  end: string;
};

export type ScheduleWindow = BusinessHours & {
  breaks?: TimeRange[];
};

/** Weekly availability keyed by JavaScript's Date#getDay() value. */
export type WeekdaySchedule = Partial<Record<Weekday, ScheduleWindow[]>>;

export type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
};

export type Professional = {
  id: string;
  name: string;
};

export type Booking = TimeRange & {
  id: string;
  professionalId: string;
};

export type BlockedSlot = TimeRange & {
  id: string;
  professionalId?: string;
};

export type AvailabilityException = {
  /** ISO date in YYYY-MM-DD format. */
  date: string;
  windows?: ScheduleWindow[];
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
