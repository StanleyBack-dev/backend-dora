import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SUPPORTER_REPOSITORY,
  type SupporterRepositoryPort,
} from "@/modules/supporters/application/ports/supporter-repository.port";
import {
  rankSupporters,
  type RankingEntry,
} from "@/modules/supporters/domain/supporter";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type SupportRanking = {
  /** Null: all time. */
  year: number | null;
  supporters: number;
  totalCents: number;
  entries: RankingEntry[];
};

/** First year the ranking can show (the project's start). */
export const FIRST_RANKING_YEAR = 2020;

// The "Apoie o Dora" ranking, open to everyone signed in: the top
// supporters by total, all time or within a year. Supporters who chose not
// to show their name appear as anonymous.
@Injectable()
export class GetSupportRankingUseCase {
  constructor(
    @Inject(SUPPORTER_REPOSITORY)
    private readonly supporters: SupporterRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(year: number | null): Promise<SupportRanking> {
    const currentYear = Number(this.clock.localDate().slice(0, 4));
    if (
      year !== null &&
      (!Number.isInteger(year) ||
        year < FIRST_RANKING_YEAR ||
        year > currentYear)
    ) {
      throw AppException.from(APP_ERRORS.supporters.invalidYear, undefined);
    }
    const [rows, totals] = await Promise.all([
      this.supporters.rankingRows(year),
      this.supporters.totals(year),
    ]);
    return { year, ...totals, entries: rankSupporters(rows) };
  }
}
