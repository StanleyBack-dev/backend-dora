import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { Permission } from "@/modules/access-control/domain/permission";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import {
  PURCHASE_INDICATORS_REPOSITORY,
  type PurchaseIndicatorsRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-indicators-repository.port";
import { periodInvalid } from "@/modules/purchases/application/purchase-errors";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  type CategorySpend,
  type IndicatorPeriod,
  type MonthSpend,
  periodRange,
  spendBreakdown,
  spendByMonth,
  type TransparencyPurchase,
  type TransparencySettings,
  validPeriod,
} from "@/modules/purchases/domain/purchase-indicators";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** Whether the accounts are published, for whoever asks. */
export type TransparencyStatus = TransparencySettings & {
  /** Publishes or withdraws them (the approvers). */
  canManage: boolean;
  /** Sees them even unpublished (the management and the approvers). */
  canPreview: boolean;
};

/** The accounts the residents see for a period. */
export type TransparencySummary = {
  period: IndicatorPeriod;
  paidCents: number;
  purchases: number;
  byCategory: CategorySpend[];
  byMonth: MonthSpend[];
};

/**
 * The residents are told the accounts are out, in the app (no e-mail: a
 * message to every resident is the broadcasts' job).
 */
const publishedNotices = (residents: string[], at: Date): OutboxDraft[] =>
  residents.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PURCHASE_TRANSPARENCY_PUBLISHED,
        title: "Prestação de contas de compras",
        body: "O condomínio publicou o que gastou em compras: por categoria, por mês e as compras concluídas. Veja em Compras > Prestação de contas.",
        link: "/compras/prestacao-de-contas",
        email: null,
        calendar: null,
      },
      `transparency-published:${at.getTime()}:${userId}`,
    ),
  );

/**
 * The purchases' accounts for the residents (prestação de contas): what
 * was paid in a year or month, by category and month, and the purchases
 * completed, with the supplier, the value and how many quotes there were.
 * Off by default: the approvers publish it; until then only the management
 * and the approvers see it (to check before publishing); publishing tells
 * the residents.
 */
@Injectable()
export class PurchaseTransparencyUseCase {
  constructor(
    @Inject(PURCHASE_INDICATORS_REPOSITORY)
    private readonly figures: PurchaseIndicatorsRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async status(actor: AuthenticatedUser): Promise<TransparencyStatus> {
    const condominiumId = await this.access.condominiumOf(actor);
    const [settings, canManage, canPreview] = await Promise.all([
      this.figures.transparency(condominiumId),
      this.access.hasAny(actor, Permission.PURCHASES_APPROVE),
      this.access.hasAny(
        actor,
        Permission.PURCHASES_MANAGE,
        Permission.PURCHASES_APPROVE,
      ),
    ]);
    return { ...settings, canManage, canPreview };
  }

  async summary(
    actor: AuthenticatedUser,
    period: IndicatorPeriod,
  ): Promise<TransparencySummary> {
    const condominiumId = await this.open(actor, period);
    const rows = await this.figures.paid(
      condominiumId,
      periodRange({ year: period.year, month: null }),
    );
    const spend = spendBreakdown(
      period.month === null
        ? rows
        : rows.filter((row) => row.month === period.month),
    );
    return {
      period,
      paidCents: spend.paidCents,
      purchases: spend.purchases,
      byCategory: spend.byCategory,
      byMonth: spendByMonth(rows),
    };
  }

  async purchases(
    actor: AuthenticatedUser,
    period: IndicatorPeriod,
    page: PageRequest,
  ): Promise<Paginated<TransparencyPurchase>> {
    const condominiumId = await this.open(actor, period);
    return this.figures.completed(condominiumId, periodRange(period), page);
  }

  async publish(
    actor: AuthenticatedUser,
    enabled: boolean,
  ): Promise<TransparencyStatus> {
    const condominiumId = await this.access.condominiumWithAny(
      actor,
      Permission.PURCHASES_APPROVE,
    );
    const residents = enabled ? await this.access.residents(condominiumId) : [];
    await this.figures.setTransparency(
      condominiumId,
      enabled,
      actor.id,
      publishedNotices(residents, this.clock.now()),
    );
    if (enabled) this.outbox.kick();
    return this.status(actor);
  }

  /** The condominium, when the caller may see its accounts for the period. */
  async open(
    actor: AuthenticatedUser,
    period: IndicatorPeriod,
  ): Promise<string> {
    if (!validPeriod(period)) throw periodInvalid();
    const condominiumId = await this.access.condominiumOf(actor);
    const [settings, preview] = await Promise.all([
      this.figures.transparency(condominiumId),
      this.access.hasAny(
        actor,
        Permission.PURCHASES_MANAGE,
        Permission.PURCHASES_APPROVE,
      ),
    ]);
    if (!settings.enabled && !preview) {
      throw AppException.from(APP_ERRORS.purchases.transparencyOff, undefined);
    }
    return condominiumId;
  }
}
