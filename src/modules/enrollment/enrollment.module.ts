import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { EnrollmentInvitesUseCase } from "@/modules/enrollment/application/use-cases/enrollment-invites.use-case";
import { EnrollmentReviewUseCase } from "@/modules/enrollment/application/use-cases/enrollment-review.use-case";
import { PublicEnrollmentUseCase } from "@/modules/enrollment/application/use-cases/public-enrollment.use-case";
import { ENROLLMENT_REPOSITORY } from "@/modules/enrollment/application/ports/enrollment-repository.port";
import { EnrollmentInviteOrmEntity } from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment-invite.orm-entity";
import { EnrollmentRequestOrmEntity } from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment-request.orm-entity";
import { EnrollmentTypeormRepository } from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment-typeorm.repository";
import { EnrollmentAdminResolver } from "@/modules/enrollment/presentation/graphql/enrollment-admin.resolver";
import { EnrollmentRequestFieldsResolver } from "@/modules/enrollment/presentation/graphql/enrollment-request-fields.resolver";
import { PublicEnrollmentResolver } from "@/modules/enrollment/presentation/graphql/public-enrollment.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Self-service sign-up through a public link: an invite code (one
// condominium's) opens the form, each answer waits for that condominium's
// managers (notified through the outbox; the platform when it has none), and
// approving it gives the person access (identity).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentInviteOrmEntity,
      EnrollmentRequestOrmEntity,
    ]),
    AccessControlModule,
    AuditModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
  ],
  providers: [
    EnrollmentInvitesUseCase,
    PublicEnrollmentUseCase,
    EnrollmentReviewUseCase,
    PublicEnrollmentResolver,
    EnrollmentAdminResolver,
    EnrollmentRequestFieldsResolver,
    { provide: ENROLLMENT_REPOSITORY, useClass: EnrollmentTypeormRepository },
  ],
})
export class EnrollmentModule {}
