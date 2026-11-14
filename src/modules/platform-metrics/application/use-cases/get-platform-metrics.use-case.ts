import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import {
  PLATFORM_METRICS_READER,
  type PlatformMetrics,
  type PlatformMetricsReaderPort,
} from "@/modules/platform-metrics/application/ports/platform-metrics-reader.port";
import {
  nextDate,
  resolvePeriod,
} from "@/modules/platform-metrics/domain/metrics-period";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type PlatformMetricsFilter = {
  from?: string | null;
  to?: string | null;
  condominiumId?: string | null;
};

export type PlatformMetricsReport = PlatformMetrics & {
  from: string;
  to: string;
  days: number;
  condominiumId: string | null;
};

// The platform panel: numbers across every condominium (or one), for the
// platform administrator. The period is in calendar days of the app's time
// zone; bookings count by when their slot happens.
@Injectable()
export class GetPlatformMetricsUseCase {
  constructor(
    @Inject(PLATFORM_METRICS_READER)
    private readonly reader: PlatformMetricsReaderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly condominiums: CondominiumLookupService,
  ) {}

  async execute(filter: PlatformMetricsFilter): Promise<PlatformMetricsReport> {
    const now = this.clock.now();
    const period = resolvePeriod(filter, this.clock.localDate(now));
    if (!period) {
      throw AppException.from(
        APP_ERRORS.platformMetrics.invalidPeriod,
        undefined,
      );
    }
    const condominiumId = filter.condominiumId ?? null;
    if (condominiumId && !(await this.condominiums.find(condominiumId))) {
      throw AppException.from(APP_ERRORS.condominiums.notFound, undefined);
    }

    const metrics = await this.reader.read({
      period,
      start: this.clock.startOfLocalDate(period.from),
      end: this.clock.startOfLocalDate(nextDate(period.to)),
      condominiumId,
      timeZone: this.clock.timeZone,
      now,
    });
    return {
      ...metrics,
      from: period.from,
      to: period.to,
      days: period.days,
      condominiumId,
    };
  }
}
