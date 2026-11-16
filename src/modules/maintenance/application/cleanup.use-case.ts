import { Inject, Injectable, Logger } from "@nestjs/common";
import { BookingsMaintenanceService } from "@/modules/bookings/application/bookings-maintenance.service";
import { EventsMaintenanceService } from "@/modules/events/application/events-maintenance.service";
import { IdentityMaintenanceService } from "@/modules/identity/application/identity-maintenance.service";
import { NotificationsUseCase } from "@/modules/notifications/application/use-cases/notifications.use-case";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { SystemLogsService } from "@/modules/system-logs/application/system-logs.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";

export type CleanupReport = {
  sessions: number;
  verificationCodes: number;
  deliveredMessages: number;
  readNotifications: number;
  rateLimitWindows: number;
  systemLogs: number;
  waitlistEntries: number;
  expiredEventOrders: number;
};

const DELIVERED_RETENTION_DAYS = 30;

// Daily housekeeping: drops data the app no longer needs (ended sessions with
// IP/browser, used recovery codes, delivered outbox messages, notifications
// read a year ago, old rate-limit windows, waiting lists of past slots) and
// expires unpaid event orders past their 48 h. Each module purges its own data.
@Injectable()
export class CleanupUseCase {
  private readonly logger = new Logger(CleanupUseCase.name);

  constructor(
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(RATE_LIMIT) private readonly rateLimits: RateLimitPort,
    private readonly identity: IdentityMaintenanceService,
    private readonly notifications: NotificationsUseCase,
    private readonly outbox: OutboxDispatcher,
    private readonly systemLogs: SystemLogsService,
    private readonly bookings: BookingsMaintenanceService,
    private readonly events: EventsMaintenanceService,
  ) {}

  async run(): Promise<CleanupReport> {
    const now = this.clock.now();
    const [
      identity,
      deliveredMessages,
      readNotifications,
      rateLimitWindows,
      systemLogs,
      waitlistEntries,
      expiredEventOrders,
    ] = await Promise.all([
      this.identity.purge(now),
      this.outbox.purgeDelivered(
        new Date(now.getTime() - DELIVERED_RETENTION_DAYS * 86_400_000),
      ),
      this.notifications.purgeOldRead(now),
      this.rateLimits.purgeEndedBefore(now),
      this.systemLogs.purgeOld(now),
      this.bookings.purge(now),
      this.events.expireOrders(now),
    ]);
    const report = {
      sessions: identity.sessions,
      verificationCodes: identity.codes,
      deliveredMessages,
      readNotifications,
      rateLimitWindows,
      systemLogs,
      waitlistEntries,
      expiredEventOrders,
    };
    this.logger.log(`Limpeza diária: ${JSON.stringify(report)}`);
    return report;
  }
}
