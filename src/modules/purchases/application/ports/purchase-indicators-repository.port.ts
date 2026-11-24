import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type {
  CommittedSpend,
  OrderProcessRow,
  PaidRow,
  TransparencyPurchase,
  TransparencySettings,
} from "@/modules/purchases/domain/purchase-indicators";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** Days as [from, to) ("YYYY-MM-DD"), in the condominium's time zone. */
export type DayRange = { from: string; to: string };

/** Read-only figures of a condominium's purchases (indicators, accounts). */
export interface PurchaseIndicatorsRepositoryPort {
  /** Installments paid in the range, by purchase, supplier and month. */
  paid(condominiumId: string, range: DayRange): Promise<PaidRow[]>;

  /** What placed orders still owe (now). */
  committed(condominiumId: string): Promise<CommittedSpend>;

  /** Each order placed in the range, for the process figures. */
  process(
    condominiumId: string,
    range: DayRange,
    today: string,
  ): Promise<OrderProcessRow[]>;

  /** The purchases completed in the range, the latest first. */
  completed(
    condominiumId: string,
    range: DayRange,
    page: PageRequest,
  ): Promise<Paginated<TransparencyPurchase>>;

  transparency(condominiumId: string): Promise<TransparencySettings>;

  /** Publishes or withdraws the accounts, writing the notices with it. */
  setTransparency(
    condominiumId: string,
    enabled: boolean,
    updatedBy: string,
    notices: OutboxDraft[],
  ): Promise<TransparencySettings>;
}

export const PURCHASE_INDICATORS_REPOSITORY = Symbol(
  "PURCHASE_INDICATORS_REPOSITORY",
);
