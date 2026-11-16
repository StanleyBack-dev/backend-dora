import { Module } from "@nestjs/common";
import { DependentAccessService } from "@/modules/dependents/application/dependent-access.service";
import { DependentLookupService } from "@/modules/dependents/application/dependent-lookup.service";
import { DEPENDENT_REPOSITORY } from "@/modules/dependents/application/ports/dependent-repository.port";
import { AddDependentUseCase } from "@/modules/dependents/application/use-cases/add-dependent.use-case";
import { ListMyDependentsUseCase } from "@/modules/dependents/application/use-cases/list-my-dependents.use-case";
import { RemoveDependentUseCase } from "@/modules/dependents/application/use-cases/remove-dependent.use-case";
import { ReviewDependentsUseCase } from "@/modules/dependents/application/use-cases/review-dependents.use-case";
import { DependentSqlRepository } from "@/modules/dependents/infrastructure/persistence/dependent-sql.repository";
import { DependentFieldsResolver } from "@/modules/dependents/presentation/graphql/dependent-fields.resolver";
import { DependentsReviewResolver } from "@/modules/dependents/presentation/graphql/dependents-review.resolver";
import { DependentsResolver } from "@/modules/dependents/presentation/graphql/dependents.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// People of a resident's household who don't use the app, registered once
// with a document and approved by the managers; events read their approved
// birth dates to price tickets.
@Module({
  imports: [IdentityModule, OutboxModule],
  providers: [
    DependentAccessService,
    DependentLookupService,
    ListMyDependentsUseCase,
    AddDependentUseCase,
    RemoveDependentUseCase,
    ReviewDependentsUseCase,
    DependentsResolver,
    DependentsReviewResolver,
    DependentFieldsResolver,
    { provide: DEPENDENT_REPOSITORY, useClass: DependentSqlRepository },
  ],
  exports: [DependentLookupService],
})
export class DependentsModule {}
