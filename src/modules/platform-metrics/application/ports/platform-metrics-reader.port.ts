import type {
  MetricsGranularity,
  MetricsPeriod,
} from "@/modules/platform-metrics/domain/metrics-period";

/** What the reader needs: the period as instants plus the scope. */
export type MetricsQuery = {
  period: MetricsPeriod;
  /** First instant of `period.from` and of the day after `period.to`. */
  start: Date;
  end: Date;
  /** One condominium, or every one (null). */
  condominiumId: string | null;
  timeZone: string;
  now: Date;
};

/** Bookings starting inside one bucket of the series. */
export type BookingsPoint = {
  /** First day of the bucket (YYYY-MM-DD). */
  bucket: string;
  total: number;
  cancelled: number;
};

export type CondominiumBookings = {
  condominiumId: string;
  name: string;
  total: number;
  cancelled: number;
};

export type BookingMetrics = {
  /** Every booking whose slot starts in the period, any status. */
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  rejected: number;
  /** Pending bookings waiting for a decision for more than 48 hours. */
  stalePending: number;
  granularity: MetricsGranularity;
  series: BookingsPoint[];
  /** The condominiums with the most bookings (top 10). */
  byCondominium: CondominiumBookings[];
};

export type SpaceUsage = {
  spaceId: string;
  name: string;
  condominiumName: string;
  /** Active bookings (pending or confirmed) in the period. */
  bookings: number;
  /** Booked time, in hours. */
  hours: number;
};

export type UsageByWeekday = { weekday: number; bookings: number };
export type UsageByHour = { hour: number; bookings: number };

export type SpaceMetrics = {
  activeSpaces: number;
  /** Most booked spaces (top 10). */
  mostUsed: SpaceUsage[];
  /** Active spaces without any booking in the period (up to 10). */
  unused: SpaceUsage[];
  unusedCount: number;
  /** 0 = Sunday … 6 = Saturday, every day present. */
  byWeekday: UsageByWeekday[];
  /** 0–23 in the app timezone, only hours with bookings. */
  byHour: UsageByHour[];
};

export type InactiveCondominium = {
  condominiumId: string;
  name: string;
  /** Most recent sign-in of any member (null: never). */
  lastActivityAt: Date | null;
};

export type EngagementMetrics = {
  /** Members with access (active membership and account). */
  members: number;
  /** Members who signed in during the last 7 / 30 days. */
  active7d: number;
  active30d: number;
  /** Memberships created in the period. */
  newMembers: number;
  /** Public sign-ups received in the period. */
  enrollments: number;
  /** Active condominiums without any sign-in in 30 days (up to 10). */
  inactiveCondominiums: InactiveCondominium[];
  inactiveCount: number;
};

export type HealthMetrics = {
  /** Sign-ups waiting for review for more than 3 days. */
  staleEnrollments: number;
  /** Notices the outbox gave up on. */
  failedNotifications: number;
  /** Notices still queued for more than an hour (e-mail problems). */
  delayedNotifications: number;
  /** Active condominiums without an active manager / without units. */
  withoutManager: number;
  withoutUnits: number;
  /** Support requests not answered yet (always the whole platform). */
  openSupport: number;
};

export type PlatformMetrics = {
  bookings: BookingMetrics;
  spaces: SpaceMetrics;
  engagement: EngagementMetrics;
  health: HealthMetrics;
};

export interface PlatformMetricsReaderPort {
  read(query: MetricsQuery): Promise<PlatformMetrics>;
}

export const PLATFORM_METRICS_READER = Symbol("PLATFORM_METRICS_READER");
