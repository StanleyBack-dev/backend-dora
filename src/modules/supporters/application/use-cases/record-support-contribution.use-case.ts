import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SUPPORTER_REPOSITORY,
  type SupporterRepositoryPort,
} from "@/modules/supporters/application/ports/supporter-repository.port";
import {
  CONTRIBUTION_VIOLATION_MESSAGES,
  normalizeContribution,
  type ContributionInput,
  type SupportContribution,
} from "@/modules/supporters/domain/supporter";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The platform administrator records a contribution that arrived by PIX.
// A name already on the list adds to that supporter.
@Injectable()
export class RecordSupportContributionUseCase {
  constructor(
    @Inject(SUPPORTER_REPOSITORY)
    private readonly supporters: SupporterRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: ContributionInput,
  ): Promise<SupportContribution> {
    const data = normalizeContribution(input, this.clock.localDate());
    if (typeof data === "string") {
      throw AppException.from(APP_ERRORS.supporters.invalidContribution, {
        reason: CONTRIBUTION_VIOLATION_MESSAGES[data],
      });
    }
    return this.supporters.record(data, actor.id);
  }
}
