import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { Permission } from "@/modules/access-control/domain/permission";
import {
  PURCHASE_INDICATORS_REPOSITORY,
  type PurchaseIndicatorsRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-indicators-repository.port";
import { periodInvalid } from "@/modules/purchases/application/purchase-errors";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  type CategorySpend,
  type CommittedSpend,
  type IndicatorPeriod,
  type MonthSpend,
  periodRange,
  type ProcessIndicators,
  processIndicators,
  type SupplierSpend,
  spendBreakdown,
  spendByMonth,
  validPeriod,
} from "@/modules/purchases/domain/purchase-indicators";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { toLocalDate } from "@/shared/domain/local-date";

export type SupplierIndicator = SupplierSpend & {
  /** The supplier's average rating (null: never rated or removed). */
  ratingAverage: number | null;
  ratingCount: number;
};

/** The management's figures of a period. */
export type PurchaseIndicators = {
  period: IndicatorPeriod;
  /** Paid in the period (cash basis). */
  paidCents: number;
  paidInstallments: number;
  purchases: number;
  /** Owed now by the placed orders (not tied to the period). */
  committed: CommittedSpend;
  byCategory: CategorySpend[];
  /** Each month of the period's year. */
  byMonth: MonthSpend[];
  bySupplier: SupplierIndicator[];
  /** The orders placed in the period. */
  process: ProcessIndicators;
};

/**
 * The purchases in figures for the management and the approvers: what was
 * paid in a year or month (by category, month and supplier), what is still
 * owed, and how the process went for the orders placed in it (savings
 * against the highest quote, quotes per purchase, time to order and to
 * deliver, late deliveries).
 */
@Injectable()
export class PurchaseIndicatorsUseCase {
  constructor(
    @Inject(PURCHASE_INDICATORS_REPOSITORY)
    private readonly figures: PurchaseIndicatorsRepositoryPort,
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async indicators(
    actor: AuthenticatedUser,
    period: IndicatorPeriod,
  ): Promise<PurchaseIndicators> {
    if (!validPeriod(period)) throw periodInvalid();
    const condominiumId = await this.access.condominiumWithAny(
      actor,
      Permission.PURCHASES_MANAGE,
      Permission.PURCHASES_APPROVE,
    );
    const range = periodRange(period);
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    const [yearRows, committed, process, options] = await Promise.all([
      this.figures.paid(
        condominiumId,
        periodRange({ year: period.year, month: null }),
      ),
      this.figures.committed(condominiumId),
      this.figures.process(condominiumId, range, today),
      this.suppliers.activeOptions(condominiumId),
    ]);
    const rows =
      period.month === null
        ? yearRows
        : yearRows.filter((row) => row.month === period.month);
    const spend = spendBreakdown(rows);
    const ratings = new Map(options.map((option) => [option.id, option]));
    return {
      period,
      paidCents: spend.paidCents,
      paidInstallments: spend.paidInstallments,
      purchases: spend.purchases,
      committed,
      byCategory: spend.byCategory,
      byMonth: spendByMonth(yearRows),
      bySupplier: spend.bySupplier.map((supplier) => {
        const rated = supplier.supplierId
          ? ratings.get(supplier.supplierId)
          : undefined;
        return {
          ...supplier,
          ratingAverage: rated?.ratingAverage ?? null,
          ratingCount: rated?.ratingCount ?? 0,
        };
      }),
      process: processIndicators(process),
    };
  }
}
