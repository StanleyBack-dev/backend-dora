import type {
  ContributionData,
  RankingRow,
  SupportContribution,
  Supporter,
} from "@/modules/supporters/domain/supporter";

export type SupporterWithContributions = Supporter & {
  history: SupportContribution[];
};

export type RankingTotals = {
  /** Supporters with at least one contribution in the period. */
  supporters: number;
  totalCents: number;
};

export interface SupporterRepositoryPort {
  /**
   * Adds the contribution to the supporter with this name (ignoring case),
   * created when new; the supporter's "show name" choice is updated.
   */
  record(
    data: ContributionData,
    createdBy: string,
  ): Promise<SupportContribution>;
  /** Everyone, the biggest total first, with each contribution. */
  listWithHistory(): Promise<SupporterWithContributions[]>;
  findById(id: string): Promise<Supporter | null>;
  /** False when another supporter already has this name. */
  update(id: string, name: string, showName: boolean): Promise<boolean>;
  /** False when it didn't exist. */
  delete(id: string): Promise<boolean>;
  /** False when it didn't exist. */
  deleteContribution(id: string): Promise<boolean>;
  /** Totals per supporter, all time (year null) or within one year. */
  rankingRows(year: number | null): Promise<RankingRow[]>;
  totals(year: number | null): Promise<RankingTotals>;
}

export const SUPPORTER_REPOSITORY = Symbol("SUPPORTER_REPOSITORY");
