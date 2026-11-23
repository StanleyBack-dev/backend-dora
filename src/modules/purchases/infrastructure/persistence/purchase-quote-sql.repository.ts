import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  ChoiceOutcome,
  PurchaseQuoteData,
  PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import type { PurchaseQuote } from "@/modules/purchases/domain/purchase-quote";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import { insertApproval } from "@/modules/purchases/infrastructure/persistence/purchase-approval-sql.repository";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

const OPEN = PurchaseRequestStatus.OPEN;
const QUOTING = PurchaseRequestStatus.QUOTING;
const AWAITING = PurchaseRequestStatus.AWAITING_APPROVAL;
const APPROVED = PurchaseRequestStatus.APPROVED;

/**
 * The supplier's name comes from the suppliers registry, read-only; the
 * prices as one JSON array.
 */
const SELECT = `
  SELECT q.idtb_purchase_quotes AS id,
         q.idtb_purchase_requests AS "requestId",
         q.idtb_suppliers AS "supplierId",
         coalesce(s.trade_name, s.name) AS "supplierName",
         (SELECT coalesce(json_agg(json_build_object(
                   'requestItemId', qi.idtb_purchase_request_items,
                   'unitPriceCents', qi.unit_price_cents)), '[]'::json)
            FROM tb_purchase_quote_items qi
           WHERE qi.idtb_purchase_quotes = q.idtb_purchase_quotes) AS items,
         q.shipping_cents AS "shippingCents",
         q.charges_cents AS "chargesCents", q.charges,
         q.discount_cents AS "discountCents",
         q.discount_percent_bp AS "discountPercentBp",
         q.interest_rate_bp AS "interestRateBp",
         q.delivery_days AS "deliveryDays",
         q.payment_method AS "paymentMethod", q.installments,
         q.payment_terms AS "paymentTerms",
         to_char(q.valid_until, 'YYYY-MM-DD') AS "validUntil",
         q.notes, q.file_key AS "fileKey", q.file_is_pdf AS "fileIsPdf",
         q.created_at AS "createdAt", q.updated_at AS "updatedAt"
    FROM tb_purchase_quotes q
    JOIN tb_suppliers s ON s.idtb_suppliers = q.idtb_suppliers`;

type Row = Omit<
  PurchaseQuote,
  "shippingCents" | "chargesCents" | "discountCents" | "items"
> & {
  shippingCents: string | number;
  chargesCents: string | number;
  discountCents: string | number;
  items: { requestItemId: string; unitPriceCents: string | number | null }[];
};

/** bigint comes back as text. */
const toQuote = (row: Row): PurchaseQuote => ({
  ...row,
  shippingCents: Number(row.shippingCents),
  chargesCents: Number(row.chargesCents),
  discountCents: Number(row.discountCents),
  items: row.items.map((item) => ({
    requestItemId: item.requestItemId,
    unitPriceCents:
      item.unitPriceCents === null ? null : Number(item.unitPriceCents),
  })),
});

@Injectable()
export class PurchaseQuoteSqlRepository implements PurchaseQuoteRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  private async byId(
    id: string,
    manager: EntityManager | DataSource = this.dataSource,
  ): Promise<PurchaseQuote> {
    const [row] = await manager.query<Row[]>(
      `${SELECT} WHERE q.idtb_purchase_quotes = $1`,
      [id],
    );
    if (!row) throw new Error(`Purchase quote ${id} not found`);
    return toQuote(row);
  }

  /** Locks the request and says whether it is in one of `statuses`. */
  private async requestIn(
    manager: EntityManager,
    requestId: string,
    statuses: PurchaseRequestStatus[],
  ): Promise<boolean> {
    const [[row]] = await manager.query<
      [{ status: PurchaseRequestStatus }[], number]
    >(
      `SELECT status FROM tb_purchase_requests
        WHERE idtb_purchase_requests = $1 FOR UPDATE`,
      [requestId],
    );
    return row !== undefined && statuses.includes(row.status);
  }

  private async writeItems(
    manager: EntityManager,
    quoteId: string,
    items: PurchaseQuoteData["items"],
  ) {
    await manager.query(
      `DELETE FROM tb_purchase_quote_items WHERE idtb_purchase_quotes = $1`,
      [quoteId],
    );
    if (items.length === 0) return;
    const params: unknown[] = [quoteId];
    const rows = items.map((item) => {
      params.push(item.requestItemId, item.unitPriceCents);
      return `($1, $${params.length - 1}, $${params.length})`;
    });
    await manager.query(
      `INSERT INTO tb_purchase_quote_items
         (idtb_purchase_quotes, idtb_purchase_request_items, unit_price_cents)
       VALUES ${rows.join(", ")}`,
      params,
    );
  }

  async listFor(requestId: string): Promise<PurchaseQuote[]> {
    const rows = await this.dataSource.query<Row[]>(
      `${SELECT} WHERE q.idtb_purchase_requests = $1 ORDER BY q.created_at`,
      [requestId],
    );
    return rows.map(toQuote);
  }

  async find(condominiumId: string, id: string): Promise<PurchaseQuote | null> {
    const [row] = await this.dataSource.query<Row[]>(
      `${SELECT}
         JOIN tb_purchase_requests r
           ON r.idtb_purchase_requests = q.idtb_purchase_requests
        WHERE r.idtb_condominiums = $1 AND q.idtb_purchase_quotes = $2`,
      [condominiumId, id],
    );
    return row ? toQuote(row) : null;
  }

  create(
    requestId: string,
    supplierId: string,
    data: PurchaseQuoteData,
  ): Promise<PurchaseQuote | null> {
    return this.dataSource.transaction(async (manager) => {
      if (!(await this.requestIn(manager, requestId, [OPEN, QUOTING]))) {
        return null;
      }
      const [inserted] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_purchase_quotes
           (idtb_purchase_requests, idtb_suppliers, shipping_cents,
            delivery_days, payment_method, installments, payment_terms,
            valid_until, notes, file_key, file_is_pdf, charges_cents,
            charges, discount_cents, interest_rate_bp, discount_percent_bp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16)
         RETURNING idtb_purchase_quotes AS id`,
        [
          requestId,
          supplierId,
          data.shippingCents,
          data.deliveryDays,
          data.paymentMethod,
          data.installments,
          data.paymentTerms,
          data.validUntil,
          data.notes,
          data.fileKey,
          data.fileIsPdf,
          data.chargesCents,
          JSON.stringify(data.charges),
          data.discountCents,
          data.interestRateBp,
          data.discountPercentBp,
        ],
      );
      await this.writeItems(manager, inserted.id, data.items);
      await manager.query(
        `UPDATE tb_purchase_requests SET status = '${QUOTING}', updated_at = now()
          WHERE idtb_purchase_requests = $1 AND status = '${OPEN}'`,
        [requestId],
      );
      return this.byId(inserted.id, manager);
    });
  }

  update(id: string, data: PurchaseQuoteData): Promise<PurchaseQuote | null> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.byId(id, manager);
      if (!(await this.requestIn(manager, current.requestId, [QUOTING]))) {
        return null;
      }
      await manager.query(
        `UPDATE tb_purchase_quotes
            SET shipping_cents = $2, delivery_days = $3, payment_method = $4,
                installments = $5, payment_terms = $6, valid_until = $7,
                notes = $8, file_key = $9, file_is_pdf = $10,
                charges_cents = $11, charges = $12,
                discount_cents = $13, interest_rate_bp = $14,
                discount_percent_bp = $15,
                updated_at = now()
          WHERE idtb_purchase_quotes = $1`,
        [
          id,
          data.shippingCents,
          data.deliveryDays,
          data.paymentMethod,
          data.installments,
          data.paymentTerms,
          data.validUntil,
          data.notes,
          data.fileKey,
          data.fileIsPdf,
          data.chargesCents,
          JSON.stringify(data.charges),
          data.discountCents,
          data.interestRateBp,
          data.discountPercentBp,
        ],
      );
      await this.writeItems(manager, id, data.items);
      return this.byId(id, manager);
    });
  }

  remove(id: string): Promise<string | null | undefined> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.byId(id, manager);
      if (!(await this.requestIn(manager, current.requestId, [QUOTING]))) {
        return undefined;
      }
      await manager.query(
        `DELETE FROM tb_purchase_quotes WHERE idtb_purchase_quotes = $1`,
        [id],
      );
      await manager.query(
        `UPDATE tb_purchase_requests SET status = '${OPEN}', updated_at = now()
          WHERE idtb_purchase_requests = $1
            AND NOT EXISTS (SELECT 1 FROM tb_purchase_quotes
                             WHERE idtb_purchase_requests = $1)`,
        [current.requestId],
      );
      return current.fileKey;
    });
  }

  choose(
    requestId: string,
    quoteId: string,
    justification: string | null,
    chosenBy: string,
    at: Date,
    outcome: ChoiceOutcome,
  ): Promise<boolean> {
    const status = outcome.autoApproval ? APPROVED : AWAITING;
    return this.dataSource.transaction(async (manager) => {
      const [changed] = await manager.query<[{ id: string }[], number]>(
        `UPDATE tb_purchase_requests
            SET status = $6, chosen_quote_id = $2,
                choice_justification = $3, chosen_by = $4, chosen_at = $5,
                updated_at = now()
          WHERE idtb_purchase_requests = $1 AND status = '${QUOTING}'
          RETURNING idtb_purchase_requests AS id`,
        [requestId, quoteId, justification, chosenBy, at, status],
      );
      if (changed.length === 0) return false;
      if (outcome.autoApproval) {
        await insertApproval(manager, outcome.autoApproval);
      }
      await this.outbox.write(manager, outcome.notices);
      return true;
    });
  }

  async reopen(requestId: string): Promise<boolean> {
    const [changed] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_purchase_requests
          SET status = '${QUOTING}', chosen_quote_id = NULL,
              choice_justification = NULL, chosen_by = NULL, chosen_at = NULL,
              updated_at = now()
        WHERE idtb_purchase_requests = $1 AND status = '${AWAITING}'
        RETURNING idtb_purchase_requests AS id`,
      [requestId],
    );
    return changed.length > 0;
  }
}
