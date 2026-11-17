import { SetMetadata } from "@nestjs/common";
import type { AppModule } from "@/modules/condominiums/domain/app-module";

// The operation belongs to an optional module (contracted apart): closed
// (403) while it is off for the session's condominium. Checked by
// ModuleGuard on each request, so turning a module off closes it at once.
export const REQUIRED_MODULE_KEY = "requiredModule";
export const RequireModule = (module: AppModule) =>
  SetMetadata(REQUIRED_MODULE_KEY, module);
