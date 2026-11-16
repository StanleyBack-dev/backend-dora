import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  CONDOMINIUM_MODULE_REPOSITORY,
  type CondominiumModuleRepositoryPort,
} from "@/modules/condominiums/application/ports/condominium-module-repository.port";
import {
  CONDOMINIUM_REPOSITORY,
  type CondominiumRepositoryPort,
} from "@/modules/condominiums/application/ports/condominium-repository.port";
import type { AppModule } from "@/modules/condominiums/domain/app-module";

// The platform administrator turns an optional module (contracted apart)
// on or off for a condominium. Turning it off keeps the module's data; it
// only closes its menu and API until it is turned on again.
@Injectable()
export class SetCondominiumModuleUseCase {
  constructor(
    @Inject(CONDOMINIUM_REPOSITORY)
    private readonly condominiums: CondominiumRepositoryPort,
    @Inject(CONDOMINIUM_MODULE_REPOSITORY)
    private readonly modules: CondominiumModuleRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    condominiumId: string,
    module: AppModule,
    enabled: boolean,
  ): Promise<void> {
    if (!(await this.condominiums.findById(condominiumId))) {
      throw AppException.from(APP_ERRORS.condominiums.notFound, undefined);
    }
    await this.modules.set(condominiumId, module, enabled, actor.id);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "condominium",
      entityId: condominiumId,
    });
  }
}
