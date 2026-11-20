import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { ParcelDeclarationService } from "@/modules/parcels/application/parcel-declaration.service";
import { ParcelsMaintenanceService } from "@/modules/parcels/application/parcels-maintenance.service";
import { PARCEL_REPOSITORY } from "@/modules/parcels/application/ports/parcel-repository.port";
import { CloseParcelUseCase } from "@/modules/parcels/application/use-cases/close-parcel.use-case";
import { FindParcelByCodeUseCase } from "@/modules/parcels/application/use-cases/find-parcel-by-code.use-case";
import { GetParcelSignatureUseCase } from "@/modules/parcels/application/use-cases/get-parcel-signature.use-case";
import { ListParcelsUseCase } from "@/modules/parcels/application/use-cases/list-parcels.use-case";
import { PickUpParcelUseCase } from "@/modules/parcels/application/use-cases/pick-up-parcel.use-case";
import { RegisterParcelUseCase } from "@/modules/parcels/application/use-cases/register-parcel.use-case";
import { SearchParcelRecipientsUseCase } from "@/modules/parcels/application/use-cases/search-parcel-recipients.use-case";
import { ParcelSqlRepository } from "@/modules/parcels/infrastructure/persistence/parcel-sql.repository";
import { ParcelFieldsResolver } from "@/modules/parcels/presentation/graphql/parcel-fields.resolver";
import { ParcelsResolver } from "@/modules/parcels/presentation/graphql/parcels.resolver";

// Parcels (encomendas), a module contracted apart (AppModule.PARCELS): the
// gate registers what arrives for a unit, the unit's residents are told
// (outbox) with a pickup code, and whoever picks it up signs on the gate's
// screen, the signature kept with its evidence. Reads units and the module
// switch (condominiums) and the unit's residents (identity).
@Module({
  imports: [
    AccessControlModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
  ],
  providers: [
    ParcelAccessService,
    ParcelDeclarationService,
    RegisterParcelUseCase,
    ListParcelsUseCase,
    FindParcelByCodeUseCase,
    PickUpParcelUseCase,
    CloseParcelUseCase,
    GetParcelSignatureUseCase,
    SearchParcelRecipientsUseCase,
    ParcelsMaintenanceService,
    ParcelsResolver,
    ParcelFieldsResolver,
    { provide: PARCEL_REPOSITORY, useClass: ParcelSqlRepository },
  ],
  exports: [ParcelsMaintenanceService],
})
export class ParcelsModule {}
