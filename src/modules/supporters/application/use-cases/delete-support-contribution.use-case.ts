import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SUPPORTER_REPOSITORY,
  type SupporterRepositoryPort,
} from "@/modules/supporters/application/ports/supporter-repository.port";

// Undoes a contribution recorded by mistake. A supporter left without any
// stays on the list (and out of the ranking) until removed.
@Injectable()
export class DeleteSupportContributionUseCase {
  constructor(
    @Inject(SUPPORTER_REPOSITORY)
    private readonly supporters: SupporterRepositoryPort,
  ) {}

  async execute(id: string): Promise<void> {
    if (!(await this.supporters.deleteContribution(id))) {
      throw AppException.from(
        APP_ERRORS.supporters.contributionNotFound,
        undefined,
      );
    }
  }
}
