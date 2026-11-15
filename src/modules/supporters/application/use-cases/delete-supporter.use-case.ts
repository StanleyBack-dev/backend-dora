import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SUPPORTER_REPOSITORY,
  type SupporterRepositoryPort,
} from "@/modules/supporters/application/ports/supporter-repository.port";

// Removes a supporter and every contribution of theirs (e.g. on request).
@Injectable()
export class DeleteSupporterUseCase {
  constructor(
    @Inject(SUPPORTER_REPOSITORY)
    private readonly supporters: SupporterRepositoryPort,
  ) {}

  async execute(id: string): Promise<void> {
    if (!(await this.supporters.delete(id))) {
      throw AppException.from(
        APP_ERRORS.supporters.supporterNotFound,
        undefined,
      );
    }
  }
}
