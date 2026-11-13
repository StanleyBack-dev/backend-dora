import { Inject, Injectable } from "@nestjs/common";

/** What managers need to act on, at a glance. */
export type Dashboard = {
  /** Enabled accounts. */
  activeUsers: number;
  /** Sign-ups from the public link waiting for review. */
  pendingEnrollments: number;
  /** Support requests not answered yet. */
  openSupportRequests: number;
  /** Notifications the outbox gave up on (needs a look). */
  failedNotifications: number;
};

export interface DashboardReaderPort {
  read(): Promise<Dashboard>;
}

export const DASHBOARD_READER = Symbol("DASHBOARD_READER");

// Read-only aggregates across modules (one round trip). Writes and rules
// stay in each module; this only counts. Each new module (bookings…) adds
// its own counters here.
@Injectable()
export class DashboardUseCase {
  constructor(
    @Inject(DASHBOARD_READER) private readonly reader: DashboardReaderPort,
  ) {}

  get(): Promise<Dashboard> {
    return this.reader.read();
  }
}
