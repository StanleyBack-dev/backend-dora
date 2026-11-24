import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  DayRange,
  PurchaseIndicatorsRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-indicators-repository.port";
import type {
  CommittedSpend,
  OrderProcessRow,
  PaidRow,
  TransparencyPurchase,
  TransparencySettings,
} from "@/modules/purchases/domain/purchase-indicators";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const S = PurchaseRequestStatus;

/** Numbers that come back as text (bigint, numeric) or null. */
const num = (value: string | number | null) =>
  value === null ? null : Number(value);

@Injectable()
export class PurchaseIndicatorsSqlRepository implements PurchaseIndicatorsRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async paid(condominiumId: string, range: DayRange): Promise<PaidRow[]> {
    const rows = await this.dataSource.query<
      (Omit<PaidRow, "paidCents"> & { paidCents: string })[]
    >(
      `SELECT o.idtb_purchase_requests AS "requestId", r.categories,
              o.idtb_suppliers AS "supplierId", o.supplier_name AS "supplierName",
              EXTRACT(MONTH FROM i.paid_on)::int AS month,
              SUM(i.amount_cents) AS "paidCents",
              COUNT(*)::int AS installments
         FROM tb_purchase_installments i
         JOIN tb_purchase_orders o
           ON o.idtb_purchase_orders = i.idtb_purchase_orders
         JOIN tb_purchase_requests r
           ON r.idtb_purchase_requests = o.idtb_purchase_requests
        WHERE o.idtb_condominiums = $1 AND o.cancelled_at IS NULL
          AND i.paid_on >= $2::date AND i.paid_on < $3::date
        GROUP BY 1, 2, 3, 4, 5`,
      [condominiumId, range.from, range.to],
    );
    return rows.map((row) => ({ ...row, paidCents: Number(row.paidCents) }));
  }

  async committed(condominiumId: string): Promise<CommittedSpend> {
    const [row] = await this.dataSource.query<
      { cents: string; installments: number; orders: number }[]
    >(
      `SELECT COALESCE(SUM(i.amount_cents), 0) AS cents,
              COUNT(*)::int AS installments,
              COUNT(DISTINCT o.idtb_purchase_orders)::int AS orders
         FROM tb_purchase_installments i
         JOIN tb_purchase_orders o
           ON o.idtb_purchase_orders = i.idtb_purchase_orders
        WHERE o.idtb_condominiums = $1 AND o.cancelled_at IS NULL
          AND i.paid_on IS NULL`,
      [condominiumId],
    );
    return { ...row, cents: Number(row.cents) };
  }

  async process(
    condominiumId: string,
    range: DayRange,
    today: string,
  ): Promise<OrderProcessRow[]> {
    const rows = await this.dataSource.query<
      {
        quoteCount: number;
        chosenCashCents: string | null;
        highestCashCents: string | null;
        daysToOrder: string;
        daysToDeliver: number | null;
        late: boolean;
      }[]
    >(
      `WITH placed AS (
         SELECT o.idtb_purchase_orders AS id, o.idtb_purchase_requests AS rid,
                o.idtb_purchase_quotes AS qid, o.ordered_at, o.expected_on,
                r.created_at, r.status
           FROM tb_purchase_orders o
           JOIN tb_purchase_requests r
             ON r.idtb_purchase_requests = o.idtb_purchase_requests
          WHERE o.idtb_condominiums = $1 AND o.cancelled_at IS NULL
            AND (o.ordered_at AT TIME ZONE $4)::date >= $2::date
            AND (o.ordered_at AT TIME ZONE $4)::date < $3::date
       ),
       wanted AS (
         SELECT idtb_purchase_requests AS rid, COUNT(*) AS items
           FROM tb_purchase_request_items
          WHERE idtb_purchase_requests IN (SELECT rid FROM placed)
          GROUP BY 1
       ),
       quotes AS (
         SELECT q.idtb_purchase_quotes AS id, q.idtb_purchase_requests AS rid,
                COUNT(qi.unit_price_cents) = MAX(w.items) AS complete,
                GREATEST(0, COALESCE(SUM(ROUND(ri.quantity * qi.unit_price_cents)), 0)
                  + q.shipping_cents + q.charges_cents - q.discount_cents) AS cash
           FROM tb_purchase_quotes q
           JOIN wanted w ON w.rid = q.idtb_purchase_requests
           LEFT JOIN tb_purchase_quote_items qi
             ON qi.idtb_purchase_quotes = q.idtb_purchase_quotes
           LEFT JOIN tb_purchase_request_items ri
             ON ri.idtb_purchase_request_items = qi.idtb_purchase_request_items
          GROUP BY q.idtb_purchase_quotes
       ),
       arrived AS (
         SELECT idtb_purchase_orders AS oid, MAX(received_on) AS last
           FROM tb_purchase_receipts
          WHERE idtb_purchase_orders IN (SELECT id FROM placed)
          GROUP BY 1
       )
       SELECT (SELECT COUNT(*) FROM quotes q WHERE q.rid = p.rid)::int AS "quoteCount",
              (SELECT q.cash FROM quotes q WHERE q.id = p.qid AND q.complete) AS "chosenCashCents",
              (SELECT MAX(q.cash) FROM quotes q WHERE q.rid = p.rid AND q.complete) AS "highestCashCents",
              EXTRACT(EPOCH FROM p.ordered_at - p.created_at) / 86400 AS "daysToOrder",
              CASE WHEN p.status IN ('${S.RECEIVED}', '${S.COMPLETED}')
                   THEN a.last - (p.ordered_at AT TIME ZONE $4)::date END AS "daysToDeliver",
              CASE WHEN p.expected_on IS NULL THEN false
                   WHEN p.status IN ('${S.RECEIVED}', '${S.COMPLETED}')
                     THEN a.last > p.expected_on
                   ELSE p.expected_on < $5::date END AS late
         FROM placed p
         LEFT JOIN arrived a ON a.oid = p.id`,
      [condominiumId, range.from, range.to, this.clock.timeZone, today],
    );
    return rows.map((row) => ({
      ...row,
      chosenCashCents: num(row.chosenCashCents),
      highestCashCents: num(row.highestCashCents),
      daysToOrder: Number(row.daysToOrder),
    }));
  }

  async completed(
    condominiumId: string,
    range: DayRange,
    page: PageRequest,
  ): Promise<Paginated<TransparencyPurchase>> {
    const where = `o.idtb_condominiums = $1 AND o.cancelled_at IS NULL
        AND r.status = '${S.COMPLETED}' AND o.completed_at IS NOT NULL
        AND (o.completed_at AT TIME ZONE $4)::date >= $2::date
        AND (o.completed_at AT TIME ZONE $4)::date < $3::date`;
    const params = [condominiumId, range.from, range.to, this.clock.timeZone];
    const [rows, [{ total }]] = await Promise.all([
      this.dataSource.query<
        (Omit<TransparencyPurchase, "totalCents"> & { totalCents: string })[]
      >(
        `SELECT r.number, r.title, r.categories,
                r.category_other AS "categoryOther",
                o.supplier_name AS "supplierName", o.total_cents AS "totalCents",
                to_char((o.completed_at AT TIME ZONE $4)::date, 'YYYY-MM-DD')
                  AS "completedOn",
                (SELECT COUNT(*) FROM tb_purchase_quotes q
                  WHERE q.idtb_purchase_requests = r.idtb_purchase_requests)::int
                  AS "quoteCount"
           FROM tb_purchase_orders o
           JOIN tb_purchase_requests r
             ON r.idtb_purchase_requests = o.idtb_purchase_requests
          WHERE ${where}
          ORDER BY o.completed_at DESC
          LIMIT $5 OFFSET $6`,
        [...params, page.limit, (page.page - 1) * page.limit],
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total
           FROM tb_purchase_orders o
           JOIN tb_purchase_requests r
             ON r.idtb_purchase_requests = o.idtb_purchase_requests
          WHERE ${where}`,
        params,
      ),
    ]);
    return paginate(
      rows.map((row) => ({ ...row, totalCents: Number(row.totalCents) })),
      total,
      page,
    );
  }

  async transparency(condominiumId: string): Promise<TransparencySettings> {
    const [row] = await this.dataSource.query<TransparencySettings[]>(
      `SELECT s.transparency_enabled AS enabled,
              s.transparency_updated_at AS "updatedAt",
              u.name AS "updatedByName"
         FROM tb_purchase_settings s
         LEFT JOIN tb_users u ON u.idtb_users = s.transparency_updated_by
        WHERE s.idtb_condominiums = $1`,
      [condominiumId],
    );
    return row ?? { enabled: false, updatedAt: null, updatedByName: null };
  }

  /**
   * The notices go out only when the accounts are turned on now (not when
   * already on, nor when withdrawn), in the same transaction.
   */
  async setTransparency(
    condominiumId: string,
    enabled: boolean,
    updatedBy: string,
    notices: OutboxDraft[],
  ): Promise<TransparencySettings> {
    await this.dataSource.transaction(async (manager) => {
      const [before] = await manager.query<{ enabled: boolean }[]>(
        `SELECT transparency_enabled AS enabled FROM tb_purchase_settings
          WHERE idtb_condominiums = $1 FOR UPDATE`,
        [condominiumId],
      );
      await manager.query(
        `INSERT INTO tb_purchase_settings
         (idtb_condominiums, transparency_enabled, transparency_updated_by,
          transparency_updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (idtb_condominiums) DO UPDATE
         SET transparency_enabled = EXCLUDED.transparency_enabled,
             transparency_updated_by = EXCLUDED.transparency_updated_by,
             transparency_updated_at = now()`,
        [condominiumId, enabled, updatedBy],
      );
      if (enabled && !before?.enabled) {
        await this.outbox.write(manager, notices);
      }
    });
    return this.transparency(condominiumId);
  }
}
