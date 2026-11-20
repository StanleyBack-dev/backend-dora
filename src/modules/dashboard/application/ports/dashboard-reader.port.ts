/** What a condominium's managers need to act on, at a glance. */
export type Dashboard = {
  /** Residents with access (active membership and account; not the team). */
  activeUsers: number;
  /** Sign-ups from the public link waiting for review. */
  pendingEnrollments: number;
  units: number;
  /** Spaces residents can book. */
  activeSpaces: number;
  /** Bookings waiting for a manager's approval. */
  pendingBookings: number;
  /** Active bookings starting today (app time zone). */
  bookingsToday: number;
  /** Support requests not answered yet (platform only, else null). */
  openSupportRequests: number | null;
  /** Notifications the outbox gave up on (platform only, else null). */
  failedNotifications: number | null;
  /** The parcels module's numbers (null: the module is off). */
  parcels: ParcelIndicators | null;
};

/** Parcels at a glance: what waits, how fast they leave, the monthly volume. */
export type ParcelIndicators = {
  /** At the desk now. */
  waiting: number;
  /** At the desk for more than PARCEL_REMINDER_DAYS. */
  stuck: number;
  /** Perishable, past the pickup deadline. */
  perishableOverdue: number;
  /** Picked up in the last 30 days, and the average hours until then. */
  pickedUpLast30Days: number;
  averagePickupHours: number | null;
  /** Received per month, oldest first (the last 6, this one included). */
  monthly: { month: string; received: number; pickedUp: number }[];
};

/** What the parcels indicators are counted against. */
export type ParcelIndicatorsWindow = {
  now: Date;
  stuckBefore: Date;
  since30Days: Date;
  /** The condominium's time zone, for the months. */
  timeZone: string;
};

export interface DashboardReaderPort {
  read(
    condominiumId: string,
    platform: boolean,
    today: { from: Date; to: Date },
  ): Promise<Omit<Dashboard, "parcels">>;
  parcels(
    condominiumId: string,
    window: ParcelIndicatorsWindow,
  ): Promise<ParcelIndicators>;
}

export const DASHBOARD_READER = Symbol("DASHBOARD_READER");
