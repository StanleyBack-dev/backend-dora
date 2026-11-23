import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  PurchaseCatalogUsage,
  PurchaseRequestData,
  PurchaseRequestFilter,
  PurchaseRequestFilterOptions,
  PurchaseRequestOverview,
  QuoteBoardOverview,
  PurchaseRequestRepositoryPort,
  PurchaseRequestScope,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  ACTIVE_REQUEST_STATUSES,
  PurchasePriority,
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

// The requester's name comes from identity and the items' products and
// brands from the catalog, read-only; the items as one JSON array, in
// their order.
const SELECT = `
  SELECT r.idtb_purchase_requests AS id, r.idtb_condominiums AS "condominiumId",
         r.number, r.title, r.description, r.categories,
         r.category_other AS "categoryOther", r.priority,
         r.idtb_spaces AS "spaceId", r.location,
         to_char(r.needed_by, 'YYYY-MM-DD') AS "neededBy", r.status,
         r.requested_by AS "requestedById", u.name AS "requestedByName",
         (SELECT coalesce(json_agg(json_build_object(
                   'id', i.idtb_purchase_request_items,
                   'productId', i.idtb_products,
                   'productName', p.name,
                   'quantity', i.quantity,
                   'unit', i.unit,
                   'brandId', i.idtb_brands,
                   'brandName', b.name,
                   'note', i.note) ORDER BY i.position), '[]'::json)
            FROM tb_purchase_request_items i
            JOIN tb_products p ON p.idtb_products = i.idtb_products
            LEFT JOIN tb_brands b ON b.idtb_brands = i.idtb_brands
           WHERE i.idtb_purchase_requests = r.idtb_purchase_requests) AS items,
         (SELECT count(*)::int FROM tb_purchase_quotes q
           WHERE q.idtb_purchase_requests = r.idtb_purchase_requests)
           AS "quoteCount",
         r.chosen_quote_id AS "chosenQuoteId",
         r.choice_justification AS "choiceJustification",
         r.chosen_at AS "chosenAt",
         r.cancel_reason AS "cancelReason", r.cancelled_at AS "cancelledAt",
         r.created_at AS "createdAt", r.updated_at AS "updatedAt"
    FROM tb_purchase_requests r
    JOIN tb_users u ON u.idtb_users = r.requested_by`;

type Row = Omit<PurchaseRequest, "items"> & {
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number | string;
    unit: string;
    brandId: string | null;
    brandName: string | null;
    note: string | null;
  }[];
};

const toRequest = (row: Row): PurchaseRequest => ({
  ...row,
  items: row.items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
  })),
});

const ACTIVE = ACTIVE_REQUEST_STATUSES.map((status) => `'${status}'`).join(
  ", ",
);

/** The WHERE of a scope (and its parameters, from $1). */
function scoped(scope: PurchaseRequestScope) {
  const params: unknown[] = [scope.condominiumId];
  const where = [`r.idtb_condominiums = $1`];
  if (scope.requesterId) {
    params.push(scope.requesterId);
    where.push(`r.requested_by = $${params.length}`);
  }
  return { params, where };
}

@Injectable()
export class PurchaseRequestSqlRepository implements PurchaseRequestRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  private async byId(
    id: string,
    manager: EntityManager | DataSource = this.dataSource,
  ): Promise<PurchaseRequest> {
    const [row] = await manager.query<Row[]>(
      `${SELECT} WHERE r.idtb_purchase_requests = $1`,
      [id],
    );
    if (!row) throw new Error(`Purchase request ${id} not found`);
    return toRequest(row);
  }

  private async writeItems(
    manager: EntityManager,
    id: string,
    items: PurchaseRequestData["items"],
  ) {
    await manager.query(
      `DELETE FROM tb_purchase_request_items WHERE idtb_purchase_requests = $1`,
      [id],
    );
    const params: unknown[] = [id];
    const rows = items.map((item, index) => {
      params.push(
        index + 1,
        item.productId,
        item.quantity,
        item.unit,
        item.brandId,
        item.note,
      );
      const at = params.length;
      const values = [5, 4, 3, 2, 1, 0].map((back) => `$${at - back}`);
      return `($1, ${values.join(", ")})`;
    });
    await manager.query(
      `INSERT INTO tb_purchase_request_items
         (idtb_purchase_requests, position, idtb_products, quantity, unit,
          idtb_brands, note)
       VALUES ${rows.join(", ")}`,
      params,
    );
  }

  create(
    condominiumId: string,
    requestedById: string,
    data: PurchaseRequestData,
    notices: (request: PurchaseRequest) => OutboxDraft[],
  ): Promise<PurchaseRequest> {
    return this.dataSource.transaction(async (manager) => {
      // One numbering at a time in the condominium (no gaps, no repeats).
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `purchase-requests:${condominiumId}`,
      ]);
      const [inserted] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_purchase_requests
           (idtb_condominiums, number, title, description, categories,
            category_other, priority, idtb_spaces, location, needed_by,
            requested_by)
         VALUES ($1,
                 (SELECT coalesce(max(number), 0) + 1 FROM tb_purchase_requests
                   WHERE idtb_condominiums = $1),
                 $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING idtb_purchase_requests AS id`,
        [
          condominiumId,
          data.title,
          data.description,
          data.categories,
          data.categoryOther,
          data.priority,
          data.spaceId,
          data.location,
          data.neededBy,
          requestedById,
        ],
      );
      await this.writeItems(manager, inserted.id, data.items);
      const request = await this.byId(inserted.id, manager);
      await this.outbox.write(manager, notices(request));
      return request;
    });
  }

  update(id: string, data: PurchaseRequestData): Promise<PurchaseRequest> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE tb_purchase_requests
            SET title = $2, description = $3, categories = $4,
                category_other = $5, priority = $6, idtb_spaces = $7,
                location = $8, needed_by = $9, updated_at = now()
          WHERE idtb_purchase_requests = $1`,
        [
          id,
          data.title,
          data.description,
          data.categories,
          data.categoryOther,
          data.priority,
          data.spaceId,
          data.location,
          data.neededBy,
        ],
      );
      await this.writeItems(manager, id, data.items);
      return this.byId(id, manager);
    });
  }

  updateDetails(
    id: string,
    data: PurchaseRequestData,
  ): Promise<PurchaseRequest | null> {
    return this.dataSource.transaction(async (manager) => {
      const changed = await manager.query<{ id: string }[]>(
        `UPDATE tb_purchase_requests
            SET priority = $2, idtb_spaces = $3, location = $4,
                needed_by = $5, updated_at = now()
          WHERE idtb_purchase_requests = $1
            AND status = '${PurchaseRequestStatus.QUOTING}'
          RETURNING idtb_purchase_requests AS id`,
        [id, data.priority, data.spaceId, data.location, data.neededBy],
      );
      return changed.length ? this.byId(id, manager) : null;
    });
  }

  cancel(
    id: string,
    cancelledBy: string,
    reason: string,
    at: Date,
    notices: OutboxDraft[],
  ): Promise<PurchaseRequest | null> {
    return this.dataSource.transaction(async (manager) => {
      const changed = await manager.query<{ id: string }[]>(
        `UPDATE tb_purchase_requests
            SET status = '${PurchaseRequestStatus.CANCELLED}',
                cancel_reason = $2, cancelled_by = $3, cancelled_at = $4,
                updated_at = now()
          WHERE idtb_purchase_requests = $1
            AND status = '${PurchaseRequestStatus.OPEN}'
          RETURNING idtb_purchase_requests AS id`,
        [id, reason, cancelledBy, at],
      );
      if (changed.length === 0) return null;
      await this.outbox.write(manager, notices);
      return this.byId(id, manager);
    });
  }

  async find(
    condominiumId: string,
    id: string,
  ): Promise<PurchaseRequest | null> {
    const [row] = await this.dataSource.query<Row[]>(
      `${SELECT} WHERE r.idtb_condominiums = $1 AND r.idtb_purchase_requests = $2`,
      [condominiumId, id],
    );
    return row ? toRequest(row) : null;
  }

  async list(
    scope: PurchaseRequestScope,
    filter: PurchaseRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<PurchaseRequest>> {
    const { params, where } = scoped(scope);
    if (filter.requestId) {
      params.push(filter.requestId);
      where.push(`r.idtb_purchase_requests = $${params.length}`);
    }
    if (filter.requestedById) {
      params.push(filter.requestedById);
      where.push(`r.requested_by = $${params.length}`);
    }
    if (filter.category) {
      params.push(filter.category);
      where.push(`$${params.length} = ANY(r.categories)`);
    }
    if (filter.priority) {
      params.push(filter.priority);
      where.push(`r.priority = $${params.length}`);
    }
    if (filter.statuses?.length) {
      params.push(filter.statuses);
      where.push(`r.status = ANY($${params.length})`);
    }
    const clause = `WHERE ${where.join(" AND ")}`;
    const [rows, [count]] = await Promise.all([
      this.dataSource.query<Row[]>(
        `${SELECT} ${clause}
          ORDER BY r.created_at DESC
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_purchase_requests r ${clause}`,
        params,
      ),
    ]);
    return paginate(rows.map(toRequest), count?.total ?? 0, page);
  }

  async filterOptions(
    scope: PurchaseRequestScope,
  ): Promise<PurchaseRequestFilterOptions> {
    const { params, where } = scoped(scope);
    const clause = `WHERE ${where.join(" AND ")}`;
    const [requests, requesters] = await Promise.all([
      this.dataSource.query<{ id: string; number: number; title: string }[]>(
        `SELECT r.idtb_purchase_requests AS id, r.number, r.title
           FROM tb_purchase_requests r ${clause}
          ORDER BY r.number DESC`,
        params,
      ),
      this.dataSource.query<{ id: string; name: string }[]>(
        `SELECT DISTINCT u.idtb_users AS id, u.name
           FROM tb_purchase_requests r
           JOIN tb_users u ON u.idtb_users = r.requested_by
          ${clause}
          ORDER BY u.name`,
        params,
      ),
    ]);
    return { requests, requesters };
  }

  async catalogUsage(condominiumId: string): Promise<PurchaseCatalogUsage> {
    // How many requests use each product (or brand) of the condominium.
    const usage = (column: string, table: string, key: string) =>
      this.dataSource.query<{ name: string; requestCount: number }[]>(
        `SELECT c.name,
                count(DISTINCT i.idtb_purchase_requests)::int AS "requestCount"
           FROM tb_purchase_request_items i
           JOIN tb_purchase_requests r
             ON r.idtb_purchase_requests = i.idtb_purchase_requests
           JOIN ${table} c ON c.${key} = i.${column}
          WHERE r.idtb_condominiums = $1
          GROUP BY c.${key}, c.name
          ORDER BY "requestCount" DESC, c.name`,
        [condominiumId],
      );
    const [products, brands] = await Promise.all([
      usage("idtb_products", "tb_products", "idtb_products"),
      usage("idtb_brands", "tb_brands", "idtb_brands"),
    ]);
    return {
      productsInUse: products.length,
      topProduct: products[0] ?? null,
      brandsInUse: brands.length,
      topBrand: brands[0] ?? null,
    };
  }

  async overview(
    scope: PurchaseRequestScope,
    today: string,
    soon: string,
  ): Promise<PurchaseRequestOverview> {
    const { params, where } = scoped(scope);
    params.push(today, soon);
    const [row] = await this.dataSource.query<PurchaseRequestOverview[]>(
      `SELECT
         count(*) FILTER (WHERE r.status = '${PurchaseRequestStatus.OPEN}')::int
           AS open,
         count(*) FILTER (WHERE r.status IN (${ACTIVE})
                            AND r.priority = '${PurchasePriority.URGENT}')::int
           AS urgent,
         count(*) FILTER (WHERE r.status IN (${ACTIVE})
                            AND r.needed_by BETWEEN $${params.length - 1}::date
                                                AND $${params.length}::date)::int
           AS "dueSoon",
         count(*) FILTER (WHERE r.status IN (${ACTIVE})
                            AND r.needed_by < $${params.length - 1}::date)::int
           AS overdue
         FROM tb_purchase_requests r
        WHERE ${where.join(" AND ")}`,
      params,
    );
    return row;
  }

  async quoteBoardOverview(
    condominiumId: string,
    minQuotes: number,
  ): Promise<QuoteBoardOverview> {
    const [row] = await this.dataSource.query<QuoteBoardOverview[]>(
      `SELECT
         count(*) FILTER (WHERE r.status = '${PurchaseRequestStatus.OPEN}')::int
           AS "awaitingQuotes",
         count(*) FILTER (WHERE r.status = '${PurchaseRequestStatus.QUOTING}')::int
           AS quoting,
         count(*) FILTER (
           WHERE r.status = '${PurchaseRequestStatus.QUOTING}'
             AND (SELECT count(*) FROM tb_purchase_quotes q
                   WHERE q.idtb_purchase_requests = r.idtb_purchase_requests)
                 < $2)::int AS "belowMinimum",
         count(*) FILTER (
           WHERE r.status = '${PurchaseRequestStatus.AWAITING_APPROVAL}')::int
           AS "awaitingApproval"
         FROM tb_purchase_requests r
        WHERE r.idtb_condominiums = $1`,
      [condominiumId, minQuotes],
    );
    return row;
  }
}
