import type { Category } from "@/modules/catalog/domain/category";

/** A year, or one of its months (1–12). */
export type IndicatorPeriod = { year: number; month: number | null };

export const INDICATOR_LIMITS = { minYear: 2020, maxYear: 2100 } as const;

/** The period's days as [from, to): "2026-01-01" to "2027-01-01". */
export function periodRange(period: IndicatorPeriod): {
  from: string;
  to: string;
} {
  const day = (year: number, month: number) =>
    `${year}-${String(month).padStart(2, "0")}-01`;
  if (period.month === null) {
    return { from: day(period.year, 1), to: day(period.year + 1, 1) };
  }
  return {
    from: day(period.year, period.month),
    to:
      period.month === 12
        ? day(period.year + 1, 1)
        : day(period.year, period.month + 1),
  };
}

/** What was paid for a purchase to a supplier in a month of the year. */
export type PaidRow = {
  requestId: string;
  categories: Category[];
  supplierId: string | null;
  supplierName: string;
  month: number;
  paidCents: number;
  installments: number;
};

export type CategorySpend = {
  category: Category;
  cents: number;
  /** Purchases with something paid in the category. */
  purchases: number;
};

export type MonthSpend = { month: number; cents: number };

export type SupplierSpend = {
  supplierId: string | null;
  supplierName: string;
  cents: number;
  purchases: number;
};

/** Spent (paid) in the period and how it splits. */
export type SpendBreakdown = {
  paidCents: number;
  paidInstallments: number;
  purchases: number;
  byCategory: CategorySpend[];
  bySupplier: SupplierSpend[];
};

/**
 * The paid rows of the period, split by category, by supplier and in
 * total. A purchase in several categories has its value divided among them
 * (the remainder to the first), so the categories add up to the total.
 */
export function spendBreakdown(rows: readonly PaidRow[]): SpendBreakdown {
  const categories = new Map<Category, { cents: number; ids: Set<string> }>();
  const suppliers = new Map<string, { row: SupplierSpend; ids: Set<string> }>();
  const purchases = new Set<string>();
  let paidCents = 0;
  let paidInstallments = 0;
  for (const row of rows) {
    paidCents += row.paidCents;
    paidInstallments += row.installments;
    purchases.add(row.requestId);
    const share = Math.floor(row.paidCents / row.categories.length);
    row.categories.forEach((category, index) => {
      const entry = categories.get(category) ?? { cents: 0, ids: new Set() };
      entry.cents +=
        share +
        (index === 0 ? row.paidCents - share * row.categories.length : 0);
      entry.ids.add(row.requestId);
      categories.set(category, entry);
    });
    const key = row.supplierId ?? `name:${row.supplierName}`;
    const supplier = suppliers.get(key) ?? {
      row: {
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        cents: 0,
        purchases: 0,
      },
      ids: new Set<string>(),
    };
    supplier.row.cents += row.paidCents;
    supplier.ids.add(row.requestId);
    suppliers.set(key, supplier);
  }
  return {
    paidCents,
    paidInstallments,
    purchases: purchases.size,
    byCategory: [...categories]
      .map(([category, entry]) => ({
        category,
        cents: entry.cents,
        purchases: entry.ids.size,
      }))
      .sort((a, b) => b.cents - a.cents),
    bySupplier: [...suppliers.values()]
      .map(({ row, ids }) => ({ ...row, purchases: ids.size }))
      .sort((a, b) => b.cents - a.cents),
  };
}

/** Paid in each month of the year (all twelve, zero when nothing). */
export function spendByMonth(rows: readonly PaidRow[]): MonthSpend[] {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    cents: 0,
  }));
  for (const row of rows) months[row.month - 1].cents += row.paidCents;
  return months;
}

/** How an order placed in the period went, for the process figures. */
export type OrderProcessRow = {
  quoteCount: number;
  /** The chosen quote paid at once (null: it wasn't complete). */
  chosenCashCents: number | null;
  /** The highest complete quote paid at once (null: none complete). */
  highestCashCents: number | null;
  /** From the request to the order. */
  daysToOrder: number;
  /** From the order to the last delivery (null: not all arrived). */
  daysToDeliver: number | null;
  late: boolean;
};

export type ProcessIndicators = {
  orders: number;
  /** The highest complete quote minus the chosen one, summed. */
  savingsCents: number;
  withThreeQuotes: number;
  avgDaysToOrder: number | null;
  avgDaysToDeliver: number | null;
  lateDeliveries: number;
};

const average = (values: number[]) =>
  values.length === 0
    ? null
    : Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
      ) / 10;

export function processIndicators(
  rows: readonly OrderProcessRow[],
): ProcessIndicators {
  return {
    orders: rows.length,
    savingsCents: rows.reduce(
      (sum, row) =>
        row.chosenCashCents !== null && row.highestCashCents !== null
          ? sum + Math.max(0, row.highestCashCents - row.chosenCashCents)
          : sum,
      0,
    ),
    withThreeQuotes: rows.filter((row) => row.quoteCount >= 3).length,
    avgDaysToOrder: average(rows.map((row) => row.daysToOrder)),
    avgDaysToDeliver: average(
      rows.flatMap((row) =>
        row.daysToDeliver === null ? [] : [row.daysToDeliver],
      ),
    ),
    lateDeliveries: rows.filter((row) => row.late).length,
  };
}

/** Placed orders not paid yet: what is still owed. */
export type CommittedSpend = {
  cents: number;
  installments: number;
  orders: number;
};

/** A completed purchase as the residents see it. */
export type TransparencyPurchase = {
  number: number;
  title: string;
  categories: Category[];
  categoryOther: string | null;
  supplierName: string;
  totalCents: number;
  completedOn: string;
  quoteCount: number;
};

/** Whether the residents see the accounts, and who set it. */
export type TransparencySettings = {
  enabled: boolean;
  updatedAt: Date | null;
  updatedByName: string | null;
};

/** A whole year in range and, if given, a month 1–12. */
export const validPeriod = (period: IndicatorPeriod) =>
  Number.isInteger(period.year) &&
  period.year >= INDICATOR_LIMITS.minYear &&
  period.year <= INDICATOR_LIMITS.maxYear &&
  (period.month === null ||
    (Number.isInteger(period.month) &&
      period.month >= 1 &&
      period.month <= 12));
