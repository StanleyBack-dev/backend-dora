import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import {
  LOST_REPORT_REPOSITORY,
  type LostReport,
  type LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// "Perdi algo" lists: the caller's own reports, and every report of the
// condominium for the desk (the resolver checks the permission), so it
// knows what people are looking for.
@Injectable()
export class ListLostReportsUseCase {
  constructor(
    @Inject(LOST_REPORT_REPOSITORY)
    private readonly reports: LostReportRepositoryPort,
    private readonly access: LostFoundAccessService,
  ) {}

  async mine(
    actor: AuthenticatedUser,
    page: PageRequest,
  ): Promise<Paginated<LostReport>> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.reports.mine(condominiumId, actor.id, page);
  }

  async all(
    actor: AuthenticatedUser,
    open: boolean,
    page: PageRequest,
  ): Promise<Paginated<LostReport>> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.reports.list(condominiumId, open, page);
  }
}
