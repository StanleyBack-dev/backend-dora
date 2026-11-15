import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SUPPORTER_REPOSITORY,
  type SupporterRepositoryPort,
} from "@/modules/supporters/application/ports/supporter-repository.port";
import {
  CONTRIBUTION_VIOLATION_MESSAGES,
  normalizeSupporterName,
  type Supporter,
} from "@/modules/supporters/domain/supporter";

// Fixes a supporter's name or whether the ranking shows it.
@Injectable()
export class UpdateSupporterUseCase {
  constructor(
    @Inject(SUPPORTER_REPOSITORY)
    private readonly supporters: SupporterRepositoryPort,
  ) {}

  async execute(
    id: string,
    input: { name: string; showName: boolean },
  ): Promise<Supporter> {
    const name = normalizeSupporterName(input.name);
    if (!name) {
      throw AppException.from(APP_ERRORS.supporters.invalidContribution, {
        reason: CONTRIBUTION_VIOLATION_MESSAGES.name,
      });
    }
    if (!(await this.supporters.findById(id))) {
      throw AppException.from(
        APP_ERRORS.supporters.supporterNotFound,
        undefined,
      );
    }
    if (!(await this.supporters.update(id, name, input.showName))) {
      throw AppException.from(APP_ERRORS.supporters.nameTaken, undefined);
    }
    const updated = await this.supporters.findById(id);
    if (!updated) {
      throw AppException.from(
        APP_ERRORS.supporters.supporterNotFound,
        undefined,
      );
    }
    return updated;
  }
}
