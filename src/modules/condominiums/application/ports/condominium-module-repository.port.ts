import type { AppModule } from "@/modules/condominiums/domain/app-module";

export interface CondominiumModuleRepositoryPort {
  /** The modules turned on for the condominium. */
  enabled(condominiumId: string): Promise<AppModule[]>;
  /** Turns a module on (recording who) or off; idempotent. */
  set(
    condominiumId: string,
    module: AppModule,
    enabled: boolean,
    actorId: string,
  ): Promise<void>;
}

export const CONDOMINIUM_MODULE_REPOSITORY = Symbol(
  "CONDOMINIUM_MODULE_REPOSITORY",
);
