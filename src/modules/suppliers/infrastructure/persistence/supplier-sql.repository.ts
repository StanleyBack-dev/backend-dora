import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  SupplierData,
  SupplierFilter,
  SupplierFilterOptions,
  SupplierOption,
  SupplierOverview,
  SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import type {
  Supplier,
  SupplierDocumentType,
  SupplierRating,
  SupplierRatingSource,
} from "@/modules/suppliers/domain/supplier";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

/** Each supplier's ratings: the average (one decimal) and how many. */
const RATINGS = `
  LEFT JOIN LATERAL (
    SELECT round(avg(r.rating), 1)::float8 AS average, count(*)::int AS count
      FROM tb_supplier_ratings r
     WHERE r.idtb_suppliers = s.idtb_suppliers
  ) rt ON rt.count > 0`;

const SELECT = `
  SELECT s.idtb_suppliers AS id, s.idtb_condominiums AS "condominiumId",
         s.document_type AS "documentType", s.document, s.name,
         s.trade_name AS "tradeName", s.categories,
         s.category_other AS "categoryOther",
         s.contact_name AS "contactName", s.email, s.phone, s.city, s.state,
         s.pix_key_type AS "pixKeyType", s.pix_key AS "pixKey", s.notes,
         s.active, rt.average AS "ratingAverage",
         coalesce(rt.count, 0) AS "ratingCount",
         s.created_at AS "createdAt", s.updated_at AS "updatedAt"
    FROM tb_suppliers s
    ${RATINGS}`;

/** The form's values in the order of the INSERT/UPDATE columns. */
const values = (data: SupplierData) => [
  data.documentType,
  data.document,
  data.name,
  data.tradeName,
  data.categories,
  data.categoryOther,
  data.contactName,
  data.email,
  data.phone,
  data.city,
  data.state,
  data.pixKeyType,
  data.pixKey,
  data.notes,
];

@Injectable()
export class SupplierSqlRepository implements SupplierRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async one(clause: string, params: unknown[]) {
    const [supplier] = await this.dataSource.query<Supplier[]>(
      `${SELECT} ${clause}`,
      params,
    );
    return supplier ?? null;
  }

  private async byId(id: string): Promise<Supplier> {
    const supplier = await this.one(`WHERE s.idtb_suppliers = $1`, [id]);
    if (!supplier) throw new Error(`Supplier ${id} not found`);
    return supplier;
  }

  async create(condominiumId: string, data: SupplierData): Promise<Supplier> {
    const [inserted] = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO tb_suppliers
         (idtb_condominiums, document_type, document, name, trade_name,
          categories, category_other, contact_name, email, phone, city, state,
          pix_key_type, pix_key, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15)
       RETURNING idtb_suppliers AS id`,
      [condominiumId, ...values(data)],
    );
    return this.byId(inserted.id);
  }

  async update(id: string, data: SupplierData): Promise<Supplier> {
    await this.dataSource.query(
      `UPDATE tb_suppliers
          SET document_type = $2, document = $3, name = $4, trade_name = $5,
              categories = $6, category_other = $7, contact_name = $8,
              email = $9, phone = $10, city = $11, state = $12,
              pix_key_type = $13, pix_key = $14, notes = $15, updated_at = now()
        WHERE idtb_suppliers = $1`,
      [id, ...values(data)],
    );
    return this.byId(id);
  }

  async setActive(id: string, active: boolean): Promise<Supplier> {
    await this.dataSource.query(
      `UPDATE tb_suppliers SET active = $2, updated_at = now()
        WHERE idtb_suppliers = $1`,
      [id, active],
    );
    return this.byId(id);
  }

  find(condominiumId: string, id: string): Promise<Supplier | null> {
    return this.one(
      `WHERE s.idtb_condominiums = $1 AND s.idtb_suppliers = $2`,
      [condominiumId, id],
    );
  }

  findByDocument(
    condominiumId: string,
    document: string,
  ): Promise<Supplier | null> {
    return this.one(`WHERE s.idtb_condominiums = $1 AND s.document = $2`, [
      condominiumId,
      document,
    ]);
  }

  async overview(condominiumId: string): Promise<SupplierOverview> {
    const [row] = await this.dataSource.query<SupplierOverview[]>(
      `SELECT count(*) FILTER (WHERE active)::int AS active,
              count(*) FILTER (WHERE NOT active)::int AS inactive,
              count(*) FILTER (WHERE active AND pix_key IS NULL)::int
                AS "activeWithoutPix",
              count(*) FILTER (WHERE active AND phone IS NULL AND email IS NULL)::int
                AS "activeWithoutContact",
              (SELECT count(DISTINCT category)::int
                 FROM tb_suppliers t, unnest(t.categories) AS category
                WHERE t.idtb_condominiums = $1 AND t.active)
                AS "categoriesServed"
         FROM tb_suppliers WHERE idtb_condominiums = $1`,
      [condominiumId],
    );
    return row;
  }

  activeOptions(condominiumId: string): Promise<SupplierOption[]> {
    return this.dataSource.query<SupplierOption[]>(
      `SELECT s.idtb_suppliers AS id, coalesce(s.trade_name, s.name) AS name,
              s.categories, s.category_other AS "categoryOther",
              rt.average AS "ratingAverage",
              coalesce(rt.count, 0) AS "ratingCount"
         FROM tb_suppliers s
         ${RATINGS}
        WHERE s.idtb_condominiums = $1 AND s.active
        ORDER BY unaccent(coalesce(s.trade_name, s.name)), s.name`,
      [condominiumId],
    );
  }

  async filterOptions(condominiumId: string): Promise<SupplierFilterOptions> {
    const [suppliers, contacts] = await Promise.all([
      this.dataSource.query<
        {
          id: string;
          name: string;
          documentType: SupplierDocumentType;
          document: string;
        }[]
      >(
        `SELECT idtb_suppliers AS id, coalesce(trade_name, name) AS name,
                document_type AS "documentType", document
           FROM tb_suppliers WHERE idtb_condominiums = $1
          ORDER BY unaccent(coalesce(trade_name, name)), name`,
        [condominiumId],
      ),
      this.dataSource.query<{ contactName: string }[]>(
        `SELECT DISTINCT contact_name AS "contactName" FROM tb_suppliers
          WHERE idtb_condominiums = $1 AND contact_name IS NOT NULL
          ORDER BY 1`,
        [condominiumId],
      ),
    ]);
    return {
      suppliers: suppliers.map(({ id, name }) => ({ id, name })),
      contacts: contacts.map((row) => row.contactName),
      documents: suppliers
        .map(({ documentType, document }) => ({ documentType, document }))
        .sort((a, b) => a.document.localeCompare(b.document)),
    };
  }

  async list(
    condominiumId: string,
    filter: SupplierFilter,
    page: PageRequest,
  ): Promise<Paginated<Supplier>> {
    const params: unknown[] = [condominiumId];
    const where = [`s.idtb_condominiums = $1`];
    if (filter.supplierId) {
      params.push(filter.supplierId);
      where.push(`s.idtb_suppliers = $${params.length}`);
    }
    if (filter.contactName) {
      params.push(filter.contactName);
      where.push(`s.contact_name = $${params.length}`);
    }
    if (filter.document) {
      params.push(filter.document);
      where.push(`s.document = $${params.length}`);
    }
    if (filter.category) {
      params.push(filter.category);
      where.push(`$${params.length} = ANY(s.categories)`);
    }
    if (filter.active !== undefined) {
      params.push(filter.active);
      where.push(`s.active = $${params.length}`);
    }
    const clause = `WHERE ${where.join(" AND ")}`;
    const [items, [count]] = await Promise.all([
      this.dataSource.query<Supplier[]>(
        `${SELECT} ${clause}
          ORDER BY s.active DESC, unaccent(coalesce(s.trade_name, s.name)), s.name
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_suppliers s ${clause}`,
        params,
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  async rate(
    supplierId: string,
    from: SupplierRatingSource,
    rating: number,
    comment: string | null,
    ratedBy: string,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO tb_supplier_ratings
         (idtb_suppliers, source, source_id, rating, comment, rated_by, rated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (source, source_id) DO UPDATE
         SET rating = EXCLUDED.rating, comment = EXCLUDED.comment,
             rated_by = EXCLUDED.rated_by, rated_at = now()`,
      [supplierId, from.source, from.sourceId, rating, comment, ratedBy],
    );
  }

  async ratingFor(from: SupplierRatingSource): Promise<SupplierRating | null> {
    const [row] = await this.dataSource.query<SupplierRating[]>(
      `SELECT r.rating, r.comment, u.name AS "ratedByName",
              r.rated_at AS "ratedAt"
         FROM tb_supplier_ratings r
         LEFT JOIN tb_users u ON u.idtb_users = r.rated_by
        WHERE r.source = $1 AND r.source_id = $2`,
      [from.source, from.sourceId],
    );
    return row ?? null;
  }
}
