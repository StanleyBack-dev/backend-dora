import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { DependentsModule } from "@/modules/dependents/dependents.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { ListResidentsUseCase } from "@/modules/residents-directory/application/use-cases/list-residents.use-case";
import { ResidentsDirectoryResolver } from "@/modules/residents-directory/presentation/graphql/residents-directory.resolver";

// The residents' directory for the gate and the managers (read only): it
// joins identity (who lives where) and dependents (approved ones) without
// either module depending on the other.
@Module({
  imports: [AccessControlModule, IdentityModule, DependentsModule],
  providers: [ListResidentsUseCase, ResidentsDirectoryResolver],
})
export class ResidentsDirectoryModule {}
