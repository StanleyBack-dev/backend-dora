import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  LANDING_EVENT_REPOSITORY,
  type LandingEventRepositoryPort,
} from "@/modules/landing/application/ports/landing-event-repository.port";
import {
  cleanEvents,
  isBotAgent,
  type LandingEventBatch,
} from "@/modules/landing/domain/landing-event";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";

/** Beacons one address may send per 10 minutes (a long visit sends ~30). */
const BEACON_RATE = { limit: 120, windowMs: 10 * 60_000 };

const clip = (value: string | null | undefined, max: number) =>
  value?.trim().slice(0, max) || null;

// Public: the landing page's analytics beacon. Never fails the caller; bots,
// malformed events and floods are dropped silently.
@Injectable()
export class RecordLandingEventsUseCase {
  private readonly logger = new Logger(RecordLandingEventsUseCase.name);

  constructor(
    @Inject(LANDING_EVENT_REPOSITORY)
    private readonly events: LandingEventRepositoryPort,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
  ) {}

  /** How many events were stored. */
  async execute(
    batch: LandingEventBatch,
    meta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<number> {
    if (isBotAgent(meta.userAgent)) return 0;
    const events = cleanEvents(batch.events);
    if (events.length === 0) return 0;

    try {
      const window = await this.limits.hit(
        `landing:beacon:${this.secrets.digest(meta.ipAddress ?? "unknown")}`,
        BEACON_RATE.windowMs,
      );
      if (window.count > BEACON_RATE.limit) return 0;

      await this.events.insertBatch({
        ...batch,
        referrerHost: clip(batch.referrerHost, 200),
        utmSource: clip(batch.utmSource, 100),
        utmMedium: clip(batch.utmMedium, 100),
        utmCampaign: clip(batch.utmCampaign, 100),
        events,
      });
      return events.length;
    } catch (error) {
      this.logger.error("Landing events not stored", error);
      return 0;
    }
  }
}
