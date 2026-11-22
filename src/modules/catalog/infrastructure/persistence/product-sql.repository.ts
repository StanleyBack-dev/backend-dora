import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  CatalogFilter,
  ProductData,
  ProductRepositoryPort,
} from "@/modules/catalog/application/ports/product-repository.port";
import type { CatalogOption, Product } from "@/modules/catalog/domain/catalog";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const SELECT = `
  SELECT p.idtb_products AS id, p.idtb_condominiums AS "condominiumId",
         p.name, p.unit, p.description, p.active,
         p.created_at AS "createdAt", p.updated_at AS "updatedAt"
    FROM tb_products p`;

@Injectable()
export class ProductSqlRepository implements ProductRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async one(clause: string, params: unknown[]) {
    const [product] = await this.dataSource.query<Product[]>(
      `${SELECT} ${clause}`,
      params,
    );
    return product ?? null;
  }

  private async byId(id: string): Promise<Product> {
    const product = await this.one(`WHERE p.idtb_products = $1`, [id]);
    if (!product) throw new Error(`Product ${id} not found`);
    return product;
  }

  async create(condominiumId: string, data: ProductData): Promise<Product> {
    const [inserted] = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO tb_products (idtb_condominiums, name, unit, description)
       VALUES ($1, $2, $3, $4) RETURNING idtb_products AS id`,
      [condominiumId, data.name, data.unit, data.description],
    );
    return this.byId(inserted.id);
  }

  async update(id: string, data: ProductData): Promise<Product> {
    await this.dataSource.query(
      `UPDATE tb_products
          SET name = $2, unit = $3, description = $4, updated_at = now()
        WHERE idtb_products = $1`,
      [id, data.name, data.unit, data.description],
    );
    return this.byId(id);
  }

  async setActive(id: string, active: boolean): Promise<Product> {
    await this.dataSource.query(
      `UPDATE tb_products SET active = $2, updated_at = now()
        WHERE idtb_products = $1`,
      [id, active],
    );
    return this.byId(id);
  }

  find(condominiumId: string, id: string): Promise<Product | null> {
    return this.one(`WHERE p.idtb_condominiums = $1 AND p.idtb_products = $2`, [
      condominiumId,
      id,
    ]);
  }

  findByName(condominiumId: string, name: string): Promise<Product | null> {
    return this.one(
      `WHERE p.idtb_condominiums = $1 AND lower(p.name) = lower($2)`,
      [condominiumId, name],
    );
  }

  async list(
    condominiumId: string,
    filter: CatalogFilter,
    page: PageRequest,
  ): Promise<Paginated<Product>> {
    const params: unknown[] = [condominiumId];
    const where = [`p.idtb_condominiums = $1`];
    if (filter.id) {
      params.push(filter.id);
      where.push(`p.idtb_products = $${params.length}`);
    }
    if (filter.active !== undefined) {
      params.push(filter.active);
      where.push(`p.active = $${params.length}`);
    }
    const clause = `WHERE ${where.join(" AND ")}`;
    const [items, [count]] = await Promise.all([
      this.dataSource.query<Product[]>(
        `${SELECT} ${clause}
          ORDER BY p.active DESC, unaccent(lower(p.name))
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_products p ${clause}`,
        params,
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  options(condominiumId: string): Promise<CatalogOption[]> {
    return this.dataSource.query<CatalogOption[]>(
      `SELECT idtb_products AS id, name, active, unit
         FROM tb_products WHERE idtb_condominiums = $1
        ORDER BY unaccent(lower(name))`,
      [condominiumId],
    );
  }

  async activeIds(
    condominiumId: string,
    ids: readonly string[],
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT idtb_products AS id FROM tb_products
        WHERE idtb_condominiums = $1 AND active
          AND idtb_products = ANY($2::uuid[])`,
      [condominiumId, ids],
    );
    return rows.map((row) => row.id);
  }

  async counts(
    condominiumId: string,
  ): Promise<{ active: number; inactive: number }> {
    const [row] = await this.dataSource.query<
      { active: number; inactive: number }[]
    >(
      `SELECT count(*) FILTER (WHERE active)::int AS active,
              count(*) FILTER (WHERE NOT active)::int AS inactive
         FROM tb_products WHERE idtb_condominiums = $1`,
      [condominiumId],
    );
    return row;
  }
}
