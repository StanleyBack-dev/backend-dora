/** What a condominium's managers need to act on, at a glance. */
export type Dashboard = {
  /** Members with access (active membership and account). */
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
};

export interface DashboardReaderPort {
  read(
    condominiumId: string,
    platform: boolean,
    today: { from: Date; to: Date },
  ): Promise<Dashboard>;
}

export const DASHBOARD_READER = Symbol("DASHBOARD_READER");
