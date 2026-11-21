import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { LostFoundDeclarationService } from "@/modules/lost-and-found/application/lost-found-declaration.service";
import { LostFoundMaintenanceService } from "@/modules/lost-and-found/application/lost-found-maintenance.service";
import { FOUND_ITEM_REPOSITORY } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import { ClaimFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/claim-found-item.use-case";
import { CloseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/close-found-item.use-case";
import { DecideClaimUseCase } from "@/modules/lost-and-found/application/use-cases/decide-claim.use-case";
import { GetReturnReceiptUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import { ListFoundItemsUseCase } from "@/modules/lost-and-found/application/use-cases/list-found-items.use-case";
import { RegisterFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/register-found-item.use-case";
import { ReleaseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/release-found-item.use-case";
import { SearchFoundItemOwnersUseCase } from "@/modules/lost-and-found/application/use-cases/search-found-item-owners.use-case";
import { ReturnFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/return-found-item.use-case";
import { FoundItemSqlRepository } from "@/modules/lost-and-found/infrastructure/persistence/found-item-sql.repository";
import { FoundItemClaimFieldsResolver } from "@/modules/lost-and-found/presentation/graphql/found-item-claim-fields.resolver";
import { FoundItemFieldsResolver } from "@/modules/lost-and-found/presentation/graphql/found-item-fields.resolver";
import { LostFoundResolver } from "@/modules/lost-and-found/presentation/graphql/lost-found.resolver";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Lost and found (achados e perdidos), a module contracted apart: items
// found in the condominium, residents' claims, returns signed on the screen
// and the keeping period.
@Module({
  imports: [
    AccessControlModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
  ],
  providers: [
    LostFoundAccessService,
    LostFoundDeclarationService,
    RegisterFoundItemUseCase,
    ListFoundItemsUseCase,
    ClaimFoundItemUseCase,
    DecideClaimUseCase,
    ReturnFoundItemUseCase,
    CloseFoundItemUseCase,
    GetReturnReceiptUseCase,
    ReleaseFoundItemUseCase,
    SearchFoundItemOwnersUseCase,
    LostFoundMaintenanceService,
    LostFoundResolver,
    FoundItemFieldsResolver,
    FoundItemClaimFieldsResolver,
    { provide: FOUND_ITEM_REPOSITORY, useClass: FoundItemSqlRepository },
  ],
  exports: [LostFoundMaintenanceService],
})
export class LostAndFoundModule {}
