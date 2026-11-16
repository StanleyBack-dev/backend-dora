import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  CONDOMINIUM_MODULE_REPOSITORY,
  type CondominiumModuleRepositoryPort,
} from "@/modules/condominiums/application/ports/condominium-module-repository.port";
import type { AppModule } from "@/modules/condominiums/domain/app-module";

// What other modules ask before working: is this optional module contracted
// by the condominium? (events checks it on every call.)
@Injectable()
export class ModuleAccessService {
  constructor(
    @Inject(CONDOMINIUM_MODULE_REPOSITORY)
    private readonly modules: CondominiumModuleRepositoryPort,
  ) {}

  enabled(condominiumId: string): Promise<AppModule[]> {
    return this.modules.enabled(condominiumId);
  }

  /** Closed (403) while the module is off for the condominium. */
  async assertEnabled(condominiumId: string, module: AppModule): Promise<void> {
    if (!(await this.modules.enabled(condominiumId)).includes(module)) {
      throw AppException.from(
        APP_ERRORS.condominiums.moduleDisabled,
        undefined,
      );
    }
  }
}
