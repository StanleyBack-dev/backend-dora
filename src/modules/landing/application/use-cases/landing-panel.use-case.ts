import { Inject, Injectable } from "@nestjs/common";
import {
  LANDING_LEAD_REPOSITORY,
  type LandingLeadRepositoryPort,
} from "@/modules/landing/application/ports/landing-lead-repository.port";
import {
  LANDING_METRICS_READER,
  type LandingMetrics,
  type LandingMetricsReaderPort,
} from "@/modules/landing/application/ports/landing-metrics-reader.port";
import type { Lead } from "@/modules/landing/domain/landing-lead";
import {
  periodFirstDay,
  resolveLandingDays,
} from "@/modules/landing/domain/landing-period";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The platform administrator's view of the landing page: traffic,
// engagement and the leads it brought in.
@Injectable()
export class LandingPanelUseCase {
  constructor(
    @Inject(LANDING_METRICS_READER)
    private readonly metrics: LandingMetricsReaderPort,
    @Inject(LANDING_LEAD_REPOSITORY)
    private readonly leads: LandingLeadRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  report(days?: number | null): Promise<LandingMetrics> {
    return this.metrics.read(resolveLandingDays(days));
  }

  listLeads(
    days: number | null | undefined,
    page: PageRequest,
  ): Promise<Paginated<Lead>> {
    const first = periodFirstDay(
      this.clock.localDate(),
      resolveLandingDays(days),
    );
    return this.leads.list(this.clock.startOfLocalDate(first), page);
  }
}
