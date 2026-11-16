import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { CondominiumPixRepositoryPort } from "@/modules/condominiums/application/ports/condominium-pix-repository.port";
import type { PixReceiver } from "@/shared/domain/pix";

const COLUMNS = `key_type AS "keyType", pix_key AS key, receiver_name AS name,
  receiver_city AS city`;

// One row per condominium (raw SQL); the stamps live in the row.
@Injectable()
export class CondominiumPixSqlRepository implements CondominiumPixRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async find(condominiumId: string): Promise<PixReceiver | null> {
    const [row] = await this.dataSource.query<PixReceiver[]>(
      `SELECT ${COLUMNS} FROM tb_condominium_pix WHERE idtb_condominiums = $1`,
      [condominiumId],
    );
    return row ?? null;
  }

  async save(
    condominiumId: string,
    receiver: PixReceiver,
    actorId: string,
  ): Promise<PixReceiver> {
    const [row] = await this.dataSource.query<PixReceiver[]>(
      `INSERT INTO tb_condominium_pix
         (idtb_condominiums, key_type, pix_key, receiver_name, receiver_city,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (idtb_condominiums) DO UPDATE
         SET key_type = EXCLUDED.key_type, pix_key = EXCLUDED.pix_key,
             receiver_name = EXCLUDED.receiver_name,
             receiver_city = EXCLUDED.receiver_city,
             updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING ${COLUMNS}`,
      [
        condominiumId,
        receiver.keyType,
        receiver.key,
        receiver.name,
        receiver.city,
        actorId,
      ],
    );
    return row;
  }

  async remove(condominiumId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM tb_condominium_pix WHERE idtb_condominiums = $1`,
      [condominiumId],
    );
  }
}
