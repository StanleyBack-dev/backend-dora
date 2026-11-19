import { Args, Int, Mutation, Resolver } from "@nestjs/graphql";
import { Public } from "@/common/decorators/public.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import { RecordLandingEventsUseCase } from "@/modules/landing/application/use-cases/record-landing-events.use-case";
import { SubmitLandingLeadUseCase } from "@/modules/landing/application/use-cases/submit-landing-lead.use-case";
import { RecordLandingEventsInput } from "@/modules/landing/presentation/graphql/dto/inputs/record-landing-events.input";
import { SubmitLandingLeadInput } from "@/modules/landing/presentation/graphql/dto/inputs/submit-landing-lead.input";

// Called by the landing page's server (internal key, no session): the
// contact form and the analytics beacon.
@Resolver()
export class PublicLandingResolver {
  constructor(
    private readonly submitLead: SubmitLandingLeadUseCase,
    private readonly recordEvents: RecordLandingEventsUseCase,
  ) {}

  @Public()
  @Mutation(() => Boolean, {
    description:
      "Recebe a mensagem do formulário do site e a envia por e-mail à equipe do Dora.",
  })
  async submitLandingLead(
    @Args("input") input: SubmitLandingLeadInput,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<boolean> {
    await this.submitLead.execute(
      {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        condominium: input.condominium ?? null,
        role: input.role,
        unitsRange: input.unitsRange ?? null,
        subject: input.subject,
        message: input.message,
      },
      {
        visitorId: input.visitorId ?? null,
        referrerHost: input.referrerHost ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
      },
      meta.ipAddress,
    );
    return true;
  }

  @Public()
  @Mutation(() => Int, {
    description:
      "Registra eventos anônimos de navegação do site; devolve quantos foram guardados.",
  })
  recordLandingEvents(
    @Args("input") input: RecordLandingEventsInput,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<number> {
    return this.recordEvents.execute(
      {
        visitorId: input.visitorId,
        sessionId: input.sessionId,
        device: input.device,
        referrerHost: input.referrerHost ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        events: input.events.map((event) => ({
          type: event.type,
          name: event.name ?? null,
          path: event.path,
        })),
      },
      meta,
    );
  }
}
