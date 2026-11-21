import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { spottedNotices } from "@/modules/lost-and-found/application/lost-report-notices";
import {
  LOST_REPORT_REPOSITORY,
  type LostReport,
  type LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import { optionalText } from "@/modules/lost-and-found/domain/found-item";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A neighbour's note ("deixei na portaria", "achei na garagem"…). */
export const SPOT_NOTE_MAX = 300;

// The neighbours' "Procura-se" board: open reports their owners chose to
// share (the resolver shows them without who lost nor the details). A
// neighbour who found one says so; the owner and the desk are told, once
// per neighbour.
@Injectable()
export class SpotLostReportUseCase {
  constructor(
    @Inject(LOST_REPORT_REPOSITORY)
    private readonly reports: LostReportRepositoryPort,
    private readonly access: LostFoundAccessService,
  ) {}

  async board(
    actor: AuthenticatedUser,
    page: PageRequest,
  ): Promise<Paginated<LostReport & { spottedByMe: boolean }>> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.reports.board(condominiumId, actor.id, page);
  }

  async spot(
    actor: AuthenticatedUser,
    id: string,
    note: string | null | undefined,
  ): Promise<void> {
    const condominiumId = await this.access.condominiumOf(actor);
    const report = await this.reports.find(condominiumId, id);
    if (
      !report ||
      !report.shared ||
      report.status !== LostReportStatus.OPEN ||
      report.userId === actor.id
    ) {
      throw AppException.from(APP_ERRORS.lostFound.reportNotFound, undefined);
    }
    const text = optionalText(note, SPOT_NOTE_MAX);
    if (text === undefined) {
      throw AppException.from(APP_ERRORS.lostFound.invalid, {
        reason: `O recado tem até ${SPOT_NOTE_MAX} caracteres.`,
      });
    }
    const staff = await this.access.staff(condominiumId);
    // Once per person: saying it again writes nothing.
    await this.reports.spot(
      report.id,
      actor.id,
      text,
      spottedNotices(report, { id: actor.id, name: actor.name }, text, staff),
    );
  }
}
