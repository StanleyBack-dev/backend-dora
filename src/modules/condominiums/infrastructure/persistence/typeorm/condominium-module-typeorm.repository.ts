import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { CondominiumModuleRepositoryPort } from "@/modules/condominiums/application/ports/condominium-module-repository.port";
import type { AppModule } from "@/modules/condominiums/domain/app-module";

// One row per module turned on; turning it off deletes the row.
@Injectable()
export class CondominiumModuleTypeormRepository implements CondominiumModuleRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async enabled(condominiumId: string): Promise<AppModule[]> {
    const rows = await this.dataSource.query<{ module: AppModule }[]>(
      `SELECT module FROM tb_condominium_modules
        WHERE idtb_condominiums = $1
        ORDER BY module`,
      [condominiumId],
    );
    return rows.map((row) => row.module);
  }

  async set(
    condominiumId: string,
    module: AppModule,
    enabled: boolean,
    actorId: string,
  ): Promise<void> {
    if (enabled) {
      await this.dataSource.query(
        `INSERT INTO tb_condominium_modules
           (idtb_condominiums, module, enabled_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (idtb_condominiums, module) DO NOTHING`,
        [condominiumId, module, actorId],
      );
    } else {
      await this.dataSource.query(
        `DELETE FROM tb_condominium_modules
          WHERE idtb_condominiums = $1 AND module = $2`,
        [condominiumId, module],
      );
    }
  }
}
