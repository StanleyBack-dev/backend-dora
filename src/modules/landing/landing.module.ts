import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IdentityModule } from "@/modules/identity/identity.module";
import { LANDING_EVENT_REPOSITORY } from "@/modules/landing/application/ports/landing-event-repository.port";
import { LANDING_LEAD_REPOSITORY } from "@/modules/landing/application/ports/landing-lead-repository.port";
import { LANDING_METRICS_READER } from "@/modules/landing/application/ports/landing-metrics-reader.port";
import { LandingPanelUseCase } from "@/modules/landing/application/use-cases/landing-panel.use-case";
import { RecordLandingEventsUseCase } from "@/modules/landing/application/use-cases/record-landing-events.use-case";
import { SubmitLandingLeadUseCase } from "@/modules/landing/application/use-cases/submit-landing-lead.use-case";
import { LandingMetricsSqlReader } from "@/modules/landing/infrastructure/persistence/landing-metrics-sql.reader";
import { LandingEventSqlRepository } from "@/modules/landing/infrastructure/persistence/typeorm/landing-event-sql.repository";
import { LandingLeadOrmEntity } from "@/modules/landing/infrastructure/persistence/typeorm/landing-lead.orm-entity";
import { LandingLeadTypeormRepository } from "@/modules/landing/infrastructure/persistence/typeorm/landing-lead-typeorm.repository";
import { LandingPanelResolver } from "@/modules/landing/presentation/graphql/landing-panel.resolver";
import { PublicLandingResolver } from "@/modules/landing/presentation/graphql/public-landing.resolver";
import { MailModule } from "@/modules/mails/mail.module";

// The public landing page (a separate Next.js site): its contact form
// (leads e-mailed to the Dora inbox), anonymous analytics, and the platform
// administrator's panel over both.
@Module({
  imports: [
    TypeOrmModule.forFeature([LandingLeadOrmEntity]),
    IdentityModule,
    MailModule,
  ],
  providers: [
    SubmitLandingLeadUseCase,
    RecordLandingEventsUseCase,
    LandingPanelUseCase,
    PublicLandingResolver,
    LandingPanelResolver,
    {
      provide: LANDING_LEAD_REPOSITORY,
      useClass: LandingLeadTypeormRepository,
    },
    { provide: LANDING_EVENT_REPOSITORY, useClass: LandingEventSqlRepository },
    { provide: LANDING_METRICS_READER, useClass: LandingMetricsSqlReader },
  ],
})
export class LandingModule {}
