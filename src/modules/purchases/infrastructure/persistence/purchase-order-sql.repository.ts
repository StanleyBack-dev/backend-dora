import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  DeliveryBoardOverview,
  InstallmentBoardOverview,
  InstallmentBoardRow,
  InstallmentFilter,
  InstallmentPayment,
  NewInstallment,
  NewPurchaseOrder,
  NewReceipt,
  OrderBoardOverview,
  PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import {
  type CancelledPurchaseOrder,
  InstallmentState,
  type PurchaseInstallment,
  type PurchaseOrder,
  type PurchaseReceipt,
} from "@/modules/purchases/domain/purchase-order";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";
import { addDays } from "@/shared/domain/local-date";

const S = PurchaseRequestStatus;

type OrderRow = Omit<
  PurchaseOrder,
  "itemsCents" | "totalCents" | "receipts" | "installments" | "rating"
> & { itemsCents: string; totalCents: string };

type ReceiptRow = Omit<PurchaseReceipt, "items" | "invoiceCents"> & {
  invoiceCents: string | null;
  items: { requestItemId: string; quantity: string | number }[];
};

type InstallmentRow = Omit<PurchaseInstallment, "amountCents"> & {
  amountCents: string;
};

/**
 * Sets the request's status from how its order stands (every item arrived,
 * every installment paid) and stamps the order completed (or not); the
 * status after it.
 */
async function syncStatus(
  manager: EntityManager,
  orderId: string,
): Promise<PurchaseRequestStatus> {
  const [[row]] = await manager.query<
    [{ status: PurchaseRequestStatus }[], number]
  >(
    `WITH o AS (
       SELECT idtb_purchase_requests AS rid FROM tb_purchase_orders
        WHERE idtb_purchase_orders = $1
     ), got AS (
       SELECT ri.idtb_purchase_request_items AS item, sum(ri.quantity) AS q
         FROM tb_purchase_receipt_items ri
         JOIN tb_purchase_receipts pr USING (idtb_purchase_receipts)
        WHERE pr.idtb_purchase_orders = $1
        GROUP BY 1
     ), state AS (
       SELECT bool_and(coalesce(got.q, 0) >= i.quantity) AS received,
              NOT EXISTS (SELECT 1 FROM tb_purchase_installments
                           WHERE idtb_purchase_orders = $1 AND paid_on IS NULL)
                AS paid
         FROM tb_purchase_request_items i
         JOIN o ON i.idtb_purchase_requests = o.rid
         LEFT JOIN got ON got.item = i.idtb_purchase_request_items
     )
     UPDATE tb_purchase_requests r
        SET status = CASE
              WHEN state.received AND state.paid THEN '${S.COMPLETED}'
              WHEN state.received THEN '${S.RECEIVED}'
              ELSE '${S.ORDERED}' END,
            updated_at = now()
       FROM o, state
      WHERE r.idtb_purchase_requests = o.rid
      RETURNING r.status`,
    [orderId],
  );
  await manager.query(
    `UPDATE tb_purchase_orders
        SET completed_at = CASE WHEN $2 = '${S.COMPLETED}'
                                THEN coalesce(completed_at, now()) END
      WHERE idtb_purchase_orders = $1`,
    [orderId, row.status],
  );
  return row.status;
}

/**
 * Each payments page filter as SQL, given the placeholders of today and of
 * a week from today.
 */
const stateSql = (
  today: string,
  week: string,
): Record<InstallmentState, string> => ({
  OPEN: `i.paid_on IS NULL AND i.due_on >= ${today}::date`,
  OVERDUE: `i.paid_on IS NULL AND i.due_on < ${today}::date`,
  DUE_SOON: `i.paid_on IS NULL AND i.due_on BETWEEN ${today}::date AND ${week}::date`,
  PAID: "i.paid_on IS NOT NULL",
});

/** The overview binds today as $2 and a week from today as $3. */
const STATE_SQL = stateSql("$2", "$3");

/** One write at a time on an order (deliveries and payments race). */
const lockOrder = (manager: EntityManager, orderId: string) =>
  manager.query(
    `SELECT 1 FROM tb_purchase_orders WHERE idtb_purchase_orders = $1 FOR UPDATE`,
    [orderId],
  );

/**
 * The orders of approved requests, their deliveries and installments
 * (names from the users, read-only).
 */
@Injectable()
export class PurchaseOrderSqlRepository implements PurchaseOrderRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async cancelledByRequest(
    condominiumId: string,
    requestId: string,
  ): Promise<CancelledPurchaseOrder[]> {
    const rows = await this.dataSource.query<
      (Omit<CancelledPurchaseOrder, "totalCents"> & { totalCents: string })[]
    >(
      `SELECT o.number, o.supplier_name AS "supplierName",
              o.total_cents AS "totalCents", o.ordered_at AS "orderedAt",
              o.cancelled_at AS "cancelledAt", u.name AS "cancelledByName",
              o.cancel_reason AS reason
         FROM tb_purchase_orders o
         LEFT JOIN tb_users u ON u.idtb_users = o.cancelled_by
        WHERE o.idtb_condominiums = $1 AND o.idtb_purchase_requests = $2
          AND o.cancelled_at IS NOT NULL
        ORDER BY o.cancelled_at DESC`,
      [condominiumId, requestId],
    );
    return rows.map((row) => ({ ...row, totalCents: Number(row.totalCents) }));
  }

  async findByRequest(
    condominiumId: string,
    requestId: string,
  ): Promise<PurchaseOrder | null> {
    const [order] = await this.dataSource.query<OrderRow[]>(
      `SELECT o.idtb_purchase_orders AS id,
              o.idtb_condominiums AS "condominiumId",
              o.idtb_purchase_requests AS "requestId",
              o.idtb_purchase_quotes AS "quoteId",
              o.idtb_suppliers AS "supplierId", o.number,
              o.supplier_name AS "supplierName",
              o.items_cents AS "itemsCents", o.total_cents AS "totalCents",
              o.payment_method AS "paymentMethod",
              o.payment_terms AS "paymentTerms",
              to_char(o.expected_on, 'YYYY-MM-DD') AS "expectedOn", o.notes,
              o.ordered_by AS "orderedById", u.name AS "orderedByName",
              o.ordered_at AS "orderedAt", o.completed_at AS "completedAt"
         FROM tb_purchase_orders o
         LEFT JOIN tb_users u ON u.idtb_users = o.ordered_by
        WHERE o.idtb_condominiums = $1 AND o.idtb_purchase_requests = $2
          AND o.cancelled_at IS NULL`,
      [condominiumId, requestId],
    );
    if (!order) return null;
    const [receipts, installments] = await Promise.all([
      this.dataSource.query<ReceiptRow[]>(
        `SELECT pr.idtb_purchase_receipts AS id,
                pr.idtb_purchase_orders AS "orderId",
                to_char(pr.received_on, 'YYYY-MM-DD') AS "receivedOn",
                pr.invoice_number AS "invoiceNumber",
                pr.invoice_cents AS "invoiceCents",
                to_char(pr.invoice_date, 'YYYY-MM-DD') AS "invoiceDate",
                pr.file_key AS "fileKey", pr.file_is_pdf AS "fileIsPdf",
                pr.note, pr.received_by AS "receivedById",
                u.name AS "receivedByName", pr.created_at AS "createdAt",
                coalesce((
                  SELECT json_agg(json_build_object(
                           'requestItemId', ri.idtb_purchase_request_items,
                           'quantity', ri.quantity))
                    FROM tb_purchase_receipt_items ri
                   WHERE ri.idtb_purchase_receipts = pr.idtb_purchase_receipts
                ), '[]') AS items
           FROM tb_purchase_receipts pr
           LEFT JOIN tb_users u ON u.idtb_users = pr.received_by
          WHERE pr.idtb_purchase_orders = $1
          ORDER BY pr.received_on, pr.created_at`,
        [order.id],
      ),
      this.dataSource.query<InstallmentRow[]>(
        `SELECT i.idtb_purchase_installments AS id,
                i.idtb_purchase_orders AS "orderId", i.number,
                i.amount_cents AS "amountCents",
                to_char(i.due_on, 'YYYY-MM-DD') AS "dueOn",
                to_char(i.paid_on, 'YYYY-MM-DD') AS "paidOn",
                i.paid_by AS "paidById", u.name AS "paidByName",
                i.proof_key AS "proofKey", i.proof_is_pdf AS "proofIsPdf",
                i.note
           FROM tb_purchase_installments i
           LEFT JOIN tb_users u ON u.idtb_users = i.paid_by
          WHERE i.idtb_purchase_orders = $1
          ORDER BY i.number`,
        [order.id],
      ),
    ]);
    return {
      ...order,
      itemsCents: Number(order.itemsCents),
      totalCents: Number(order.totalCents),
      receipts: receipts.map((receipt) => ({
        ...receipt,
        invoiceCents:
          receipt.invoiceCents === null ? null : Number(receipt.invoiceCents),
        items: receipt.items.map((item) => ({
          requestItemId: item.requestItemId,
          quantity: Number(item.quantity),
        })),
      })),
      installments: installments.map((installment) => ({
        ...installment,
        amountCents: Number(installment.amountCents),
      })),
      rating: null,
    };
  }

  /** One numbering at a time per condominium: no gaps, no repeats. */
  create(
    order: NewPurchaseOrder,
    installments: NewInstallment[],
    notices: (number: number) => OutboxDraft[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const [changed] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_purchase_requests SET status = '${S.ORDERED}', updated_at = now()
          WHERE idtb_purchase_requests = $1 AND status = '${S.APPROVED}'
          RETURNING idtb_purchase_requests AS id`,
        [order.requestId],
      );
      if (changed.length === 0) return false;
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `purchase-orders:${order.condominiumId}`,
      ]);
      const [inserted] = await manager.query<{ id: string; number: number }[]>(
        `INSERT INTO tb_purchase_orders (
           idtb_condominiums, idtb_purchase_requests, idtb_purchase_quotes,
           idtb_suppliers, number, supplier_name, items_cents, total_cents,
           payment_method, payment_terms, expected_on, notes, ordered_by,
           ordered_at)
         VALUES ($1, $2, $3, $4,
                 (SELECT coalesce(max(number), 0) + 1 FROM tb_purchase_orders
                   WHERE idtb_condominiums = $1),
                 $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING idtb_purchase_orders AS id, number`,
        [
          order.condominiumId,
          order.requestId,
          order.quoteId,
          order.supplierId,
          order.supplierName,
          order.itemsCents,
          order.totalCents,
          order.paymentMethod,
          order.paymentTerms,
          order.expectedOn,
          order.notes,
          order.orderedById,
          order.orderedAt,
        ],
      );
      for (const installment of installments) {
        await manager.query(
          `INSERT INTO tb_purchase_installments
             (idtb_purchase_orders, number, amount_cents, due_on)
           VALUES ($1, $2, $3, $4)`,
          [
            inserted.id,
            installment.number,
            installment.amountCents,
            installment.dueOn,
          ],
        );
      }
      await this.outbox.write(manager, notices(inserted.number));
      return true;
    });
  }

  addReceipt(
    orderId: string,
    receipt: NewReceipt,
    notices: OutboxDraft[],
  ): Promise<PurchaseRequestStatus> {
    return this.dataSource.transaction(async (manager) => {
      await lockOrder(manager, orderId);
      const [inserted] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_purchase_receipts (
           idtb_purchase_orders, received_on, invoice_number, invoice_cents,
           invoice_date, file_key, file_is_pdf, note, received_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING idtb_purchase_receipts AS id`,
        [
          orderId,
          receipt.receivedOn,
          receipt.invoiceNumber,
          receipt.invoiceCents,
          receipt.invoiceDate,
          receipt.fileKey,
          receipt.fileIsPdf,
          receipt.note,
          receipt.receivedById,
        ],
      );
      for (const item of receipt.items) {
        await manager.query(
          `INSERT INTO tb_purchase_receipt_items
             (idtb_purchase_receipts, idtb_purchase_request_items, quantity)
           VALUES ($1, $2, $3)`,
          [inserted.id, item.requestItemId, item.quantity],
        );
      }
      const status = await syncStatus(manager, orderId);
      await this.outbox.write(manager, notices);
      return status;
    });
  }

  removeReceipt(
    orderId: string,
    receiptId: string,
  ): Promise<string | null | undefined> {
    return this.dataSource.transaction(async (manager) => {
      await lockOrder(manager, orderId);
      const [[removed]] = await manager.query<
        [{ fileKey: string | null }[], number]
      >(
        `DELETE FROM tb_purchase_receipts
          WHERE idtb_purchase_receipts = $1 AND idtb_purchase_orders = $2
          RETURNING file_key AS "fileKey"`,
        [receiptId, orderId],
      );
      if (!removed) return undefined;
      await syncStatus(manager, orderId);
      return removed.fileKey;
    });
  }

  payInstallment(
    orderId: string,
    installmentId: string,
    payment: InstallmentPayment,
    notices: OutboxDraft[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await lockOrder(manager, orderId);
      const [changed] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_purchase_installments
            SET paid_on = $3, paid_by = $4, proof_key = $5, proof_is_pdf = $6,
                note = $7
          WHERE idtb_purchase_installments = $1
            AND idtb_purchase_orders = $2 AND paid_on IS NULL
          RETURNING idtb_purchase_installments AS id`,
        [
          installmentId,
          orderId,
          payment.paidOn,
          payment.paidById,
          payment.proofKey,
          payment.proofIsPdf,
          payment.note,
        ],
      );
      if (changed.length === 0) return false;
      await syncStatus(manager, orderId);
      await this.outbox.write(manager, notices);
      return true;
    });
  }

  unpayInstallment(
    orderId: string,
    installmentId: string,
  ): Promise<string | null | undefined> {
    return this.dataSource.transaction(async (manager) => {
      await lockOrder(manager, orderId);
      const [previous] = await manager.query<{ proofKey: string | null }[]>(
        `SELECT proof_key AS "proofKey" FROM tb_purchase_installments
          WHERE idtb_purchase_installments = $1
            AND idtb_purchase_orders = $2 AND paid_on IS NOT NULL`,
        [installmentId, orderId],
      );
      if (!previous) return undefined;
      await manager.query(
        `UPDATE tb_purchase_installments
            SET paid_on = NULL, paid_by = NULL, proof_key = NULL,
                proof_is_pdf = NULL, note = NULL
          WHERE idtb_purchase_installments = $1`,
        [installmentId],
      );
      await syncStatus(manager, orderId);
      return previous.proofKey;
    });
  }

  async overview(
    condominiumId: string,
    today: string,
    monthStart: Date,
  ): Promise<OrderBoardOverview> {
    const [row] = await this.dataSource.query<
      (Omit<OrderBoardOverview, "unpaidCents"> & { unpaidCents: string })[]
    >(
      `SELECT
         (SELECT count(*)::int FROM tb_purchase_requests
           WHERE idtb_condominiums = $1 AND status = '${S.APPROVED}') AS "toOrder",
         (SELECT count(*)::int FROM tb_purchase_requests
           WHERE idtb_condominiums = $1 AND status = '${S.ORDERED}') AS "awaitingDelivery",
         count(i.*) FILTER (WHERE i.paid_on IS NULL)::int AS "unpaidInstallments",
         coalesce(sum(i.amount_cents) FILTER (WHERE i.paid_on IS NULL), 0)
           AS "unpaidCents",
         count(i.*) FILTER (WHERE i.paid_on IS NULL AND i.due_on < $2::date)::int
           AS "overdueInstallments",
         (SELECT count(*)::int FROM tb_purchase_orders
           WHERE idtb_condominiums = $1 AND completed_at >= $3) AS "completedThisMonth"
         FROM tb_purchase_orders o
         LEFT JOIN tb_purchase_installments i
           ON i.idtb_purchase_orders = o.idtb_purchase_orders
        WHERE o.idtb_condominiums = $1 AND o.cancelled_at IS NULL`,
      [condominiumId, today, monthStart],
    );
    return { ...row, unpaidCents: Number(row.unpaidCents) };
  }

  cancel(
    orderId: string,
    cancel: { by: string; reason: string; backToQuotes: boolean },
    notices: OutboxDraft[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await lockOrder(manager, orderId);
      const [[cancelled]] = await manager.query<
        [{ requestId: string }[], number]
      >(
        `UPDATE tb_purchase_orders o
            SET cancelled_at = now(), cancelled_by = $2, cancel_reason = $3
          WHERE o.idtb_purchase_orders = $1 AND o.cancelled_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM tb_purchase_receipts r
                             WHERE r.idtb_purchase_orders = o.idtb_purchase_orders)
            AND NOT EXISTS (SELECT 1 FROM tb_purchase_installments i
                             WHERE i.idtb_purchase_orders = o.idtb_purchase_orders
                               AND i.paid_on IS NOT NULL)
          RETURNING o.idtb_purchase_requests AS "requestId"`,
        [orderId, cancel.by, cancel.reason],
      );
      if (!cancelled) return false;
      await manager.query(
        cancel.backToQuotes
          ? `UPDATE tb_purchase_requests
                SET status = '${S.QUOTING}', chosen_quote_id = NULL,
                    choice_justification = NULL, chosen_by = NULL,
                    chosen_at = NULL, updated_at = now()
              WHERE idtb_purchase_requests = $1`
          : `UPDATE tb_purchase_requests SET status = '${S.APPROVED}', updated_at = now()
              WHERE idtb_purchase_requests = $1`,
        [cancelled.requestId],
      );
      await this.outbox.write(manager, notices);
      return true;
    });
  }

  async reschedule(
    orderId: string,
    installmentId: string,
    dueOn: string,
  ): Promise<boolean> {
    const [changed] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_purchase_installments SET due_on = $3
        WHERE idtb_purchase_installments = $1 AND idtb_purchase_orders = $2
          AND paid_on IS NULL
        RETURNING idtb_purchase_installments AS id`,
      [installmentId, orderId, dueOn],
    );
    return changed.length > 0;
  }

  async installments(
    condominiumId: string,
    filter: InstallmentFilter,
    page: PageRequest,
    today: string,
  ): Promise<Paginated<InstallmentBoardRow>> {
    const params: unknown[] = [condominiumId];
    const where = ["o.idtb_condominiums = $1", "o.cancelled_at IS NULL"];
    if (filter.states?.length) {
      const bind = (value: string) => {
        params.push(value);
        return `$${params.length}`;
      };
      const needsToday = filter.states.some((state) => state !== "PAID");
      const today$ = needsToday ? bind(today) : "";
      const week$ = filter.states.includes(InstallmentState.DUE_SOON)
        ? bind(addDays(today, 7))
        : "";
      const sql = stateSql(today$, week$);
      where.push(`(${filter.states.map((state) => sql[state]).join(" OR ")})`);
    }
    if (filter.requestId) {
      params.push(filter.requestId);
      where.push(`o.idtb_purchase_requests = $${params.length}`);
    }
    if (filter.supplierId) {
      params.push(filter.supplierId);
      where.push(`o.idtb_suppliers = $${params.length}`);
    }
    const joins = `FROM tb_purchase_installments i
         JOIN tb_purchase_orders o
           ON o.idtb_purchase_orders = i.idtb_purchase_orders
         JOIN tb_purchase_requests r
           ON r.idtb_purchase_requests = o.idtb_purchase_requests`;
    const clause = `WHERE ${where.join(" AND ")}`;
    const [rows, [count]] = await Promise.all([
      this.dataSource.query<
        (Omit<InstallmentBoardRow, "amountCents"> & { amountCents: string })[]
      >(
        `SELECT i.idtb_purchase_installments AS id,
                i.idtb_purchase_orders AS "orderId", i.number,
                i.amount_cents AS "amountCents",
                to_char(i.due_on, 'YYYY-MM-DD') AS "dueOn",
                to_char(i.paid_on, 'YYYY-MM-DD') AS "paidOn",
                i.paid_by AS "paidById", u.name AS "paidByName",
                i.proof_key AS "proofKey", i.proof_is_pdf AS "proofIsPdf",
                i.note, r.idtb_purchase_requests AS "requestId",
                r.number AS "requestNumber", r.title AS "requestTitle",
                o.number AS "orderNumber", o.ordered_at AS "orderedAt",
                o.supplier_name AS "supplierName",
                (SELECT count(*)::int FROM tb_purchase_installments n
                  WHERE n.idtb_purchase_orders = o.idtb_purchase_orders)
                  AS "installmentCount"
           ${joins}
           LEFT JOIN tb_users u ON u.idtb_users = i.paid_by
           ${clause}
          ORDER BY (i.paid_on IS NOT NULL), i.due_on, o.number, i.number
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total ${joins} ${clause}`,
        params,
      ),
    ]);
    return paginate(
      rows.map((row) => ({ ...row, amountCents: Number(row.amountCents) })),
      count?.total ?? 0,
      page,
    );
  }

  async installmentOverview(
    condominiumId: string,
    today: string,
    monthStart: string,
  ): Promise<InstallmentBoardOverview> {
    const [row] = await this.dataSource.query<
      Record<keyof InstallmentBoardOverview, string | number>[]
    >(
      `SELECT
         coalesce(sum(i.amount_cents) FILTER (WHERE i.paid_on IS NULL), 0) AS "openCents",
         count(*) FILTER (WHERE i.paid_on IS NULL)::int AS "openCount",
         coalesce(sum(i.amount_cents) FILTER (WHERE ${STATE_SQL.OVERDUE}), 0) AS "overdueCents",
         count(*) FILTER (WHERE ${STATE_SQL.OVERDUE})::int AS "overdueCount",
         coalesce(sum(i.amount_cents) FILTER (WHERE ${STATE_SQL.DUE_SOON}), 0) AS "dueSoonCents",
         count(*) FILTER (WHERE ${STATE_SQL.DUE_SOON})::int AS "dueSoonCount",
         coalesce(sum(i.amount_cents) FILTER (WHERE i.paid_on >= $4::date), 0) AS "paidThisMonthCents",
         count(*) FILTER (WHERE i.paid_on >= $4::date)::int AS "paidThisMonthCount"
         FROM tb_purchase_installments i
         JOIN tb_purchase_orders o
           ON o.idtb_purchase_orders = i.idtb_purchase_orders
        WHERE o.idtb_condominiums = $1 AND o.cancelled_at IS NULL`,
      [condominiumId, today, addDays(today, 7), monthStart],
    );
    return {
      openCents: Number(row.openCents),
      openCount: Number(row.openCount),
      overdueCents: Number(row.overdueCents),
      overdueCount: Number(row.overdueCount),
      dueSoonCents: Number(row.dueSoonCents),
      dueSoonCount: Number(row.dueSoonCount),
      paidThisMonthCents: Number(row.paidThisMonthCents),
      paidThisMonthCount: Number(row.paidThisMonthCount),
    };
  }

  async deliveryOverview(
    condominiumId: string,
    today: string,
    monthStart: string,
  ): Promise<DeliveryBoardOverview> {
    const [row] = await this.dataSource.query<DeliveryBoardOverview[]>(
      `SELECT
         count(*) FILTER (WHERE r.status = '${S.ORDERED}')::int AS "awaitingDelivery",
         count(*) FILTER (WHERE r.status = '${S.ORDERED}'
                            AND o.expected_on < $2::date)::int AS "lateDeliveries",
         count(*) FILTER (WHERE r.status = '${S.ORDERED}' AND EXISTS (
                            SELECT 1 FROM tb_purchase_receipts d
                             WHERE d.idtb_purchase_orders = o.idtb_purchase_orders))::int
           AS "partialDeliveries",
         (SELECT count(*)::int FROM tb_purchase_receipts d
            JOIN tb_purchase_orders x
              ON x.idtb_purchase_orders = d.idtb_purchase_orders
           WHERE x.idtb_condominiums = $1 AND x.cancelled_at IS NULL
             AND d.received_on >= $3::date) AS "receiptsThisMonth"
         FROM tb_purchase_orders o
         JOIN tb_purchase_requests r
           ON r.idtb_purchase_requests = o.idtb_purchase_requests
        WHERE o.idtb_condominiums = $1 AND o.cancelled_at IS NULL`,
      [condominiumId, today, monthStart],
    );
    return row;
  }
}
