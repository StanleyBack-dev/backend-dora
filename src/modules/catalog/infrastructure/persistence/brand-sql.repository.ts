import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { BrandRepositoryPort } from "@/modules/catalog/application/ports/brand-repository.port";
import type { CatalogFilter } from "@/modules/catalog/application/ports/product-repository.port";
import type { Brand, CatalogOption } from "@/modules/catalog/domain/catalog";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const SELECT = `
  SELECT b.idtb_brands AS id, b.idtb_condominiums AS "condominiumId",
         b.name, b.active,
         b.created_at AS "createdAt", b.updated_at AS "updatedAt"
    FROM tb_brands b`;

@Injectable()
export class BrandSqlRepository implements BrandRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async one(clause: string, params: unknown[]) {
    const [brand] = await this.dataSource.query<Brand[]>(
      `${SELECT} ${clause}`,
      params,
    );
    return brand ?? null;
  }

  private async byId(id: string): Promise<Brand> {
    const brand = await this.one(`WHERE b.idtb_brands = $1`, [id]);
    if (!brand) throw new Error(`Brand ${id} not found`);
    return brand;
  }

  async create(condominiumId: string, name: string): Promise<Brand> {
    const [inserted] = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO tb_brands (idtb_condominiums, name)
       VALUES ($1, $2) RETURNING idtb_brands AS id`,
      [condominiumId, name],
    );
    return this.byId(inserted.id);
  }

  async rename(id: string, name: string): Promise<Brand> {
    await this.dataSource.query(
      `UPDATE tb_brands SET name = $2, updated_at = now()
        WHERE idtb_brands = $1`,
      [id, name],
    );
    return this.byId(id);
  }

  async setActive(id: string, active: boolean): Promise<Brand> {
    await this.dataSource.query(
      `UPDATE tb_brands SET active = $2, updated_at = now()
        WHERE idtb_brands = $1`,
      [id, active],
    );
    return this.byId(id);
  }

  find(condominiumId: string, id: string): Promise<Brand | null> {
    return this.one(`WHERE b.idtb_condominiums = $1 AND b.idtb_brands = $2`, [
      condominiumId,
      id,
    ]);
  }

  findByName(condominiumId: string, name: string): Promise<Brand | null> {
    return this.one(
      `WHERE b.idtb_condominiums = $1 AND lower(b.name) = lower($2)`,
      [condominiumId, name],
    );
  }

  async list(
    condominiumId: string,
    filter: CatalogFilter,
    page: PageRequest,
  ): Promise<Paginated<Brand>> {
    const params: unknown[] = [condominiumId];
    const where = [`b.idtb_condominiums = $1`];
    if (filter.id) {
      params.push(filter.id);
      where.push(`b.idtb_brands = $${params.length}`);
    }
    if (filter.active !== undefined) {
      params.push(filter.active);
      where.push(`b.active = $${params.length}`);
    }
    const clause = `WHERE ${where.join(" AND ")}`;
    const [items, [count]] = await Promise.all([
      this.dataSource.query<Brand[]>(
        `${SELECT} ${clause}
          ORDER BY b.active DESC, unaccent(lower(b.name))
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_brands b ${clause}`,
        params,
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  options(condominiumId: string): Promise<CatalogOption[]> {
    return this.dataSource.query<CatalogOption[]>(
      `SELECT idtb_brands AS id, name, active
         FROM tb_brands WHERE idtb_condominiums = $1
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
      `SELECT idtb_brands AS id FROM tb_brands
        WHERE idtb_condominiums = $1 AND active
          AND idtb_brands = ANY($2::uuid[])`,
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
         FROM tb_brands WHERE idtb_condominiums = $1`,
      [condominiumId],
    );
    return row;
  }
}
