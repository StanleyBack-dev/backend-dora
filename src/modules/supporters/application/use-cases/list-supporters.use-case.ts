import { Inject, Injectable } from "@nestjs/common";
import {
  SUPPORTER_REPOSITORY,
  type SupporterRepositoryPort,
  type SupporterWithContributions,
} from "@/modules/supporters/application/ports/supporter-repository.port";

// Everyone who supported the project, with each contribution (platform
// administrator only: names hidden in the ranking show here).
@Injectable()
export class ListSupportersUseCase {
  constructor(
    @Inject(SUPPORTER_REPOSITORY)
    private readonly supporters: SupporterRepositoryPort,
  ) {}

  execute(): Promise<SupporterWithContributions[]> {
    return this.supporters.listWithHistory();
  }
}
