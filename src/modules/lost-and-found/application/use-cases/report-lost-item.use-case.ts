import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import {
  LOST_REPORT_REPOSITORY,
  type LostReport,
  type LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import {
  type FoundItemCategory,
  optionalText,
} from "@/modules/lost-and-found/domain/found-item";
import {
  LOST_REPORT_TEXT_LIMITS,
  LostReportStatus,
} from "@/modules/lost-and-found/domain/lost-report";
import {
  FOUND_ITEM_PHOTO_MAX_BYTES,
  FOUND_ITEM_PHOTO_MAX_SIDE,
} from "@/modules/lost-and-found/application/use-cases/register-found-item.use-case";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { decodeBase64Image } from "@/shared/domain/image-upload";
import { isLocalDate, toLocalDate } from "@/shared/domain/local-date";

export type ReportLostItemInput = {
  category: FoundItemCategory;
  title: string;
  description?: string | null;
  lostLocation?: string | null;
  /** The local day it was lost ("2026-11-20"; never in the future). */
  lostOn?: string | null;
  /** Base64 JPEG/PNG/WebP (no data: prefix): the object, or one like it. */
  photo?: string | null;
  /** Shown to the neighbours on the board (default: no). */
  shared?: boolean | null;
};

const invalid = (reason: string) =>
  AppException.from(APP_ERRORS.lostFound.invalid, { reason });

// "Perdi algo": anyone of the condominium says what they lost. Nobody is
// told now; when the desk registers an item of that category, they are
// (and they find the kept ones of that category on the report). They close
// it when they got it back or gave up; a return to them closes it too.
@Injectable()
export class ReportLostItemUseCase {
  private readonly logger = new Logger(ReportLostItemUseCase.name);

  constructor(
    @Inject(LOST_REPORT_REPOSITORY)
    private readonly reports: LostReportRepositoryPort,
    private readonly access: LostFoundAccessService,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async report(
    actor: AuthenticatedUser,
    input: ReportLostItemInput,
  ): Promise<LostReport> {
    const condominiumId = await this.access.condominiumOf(actor);
    const title = optionalText(input.title, LOST_REPORT_TEXT_LIMITS.title);
    if (!title) {
      throw invalid(
        `Diga o que perdeu (até ${LOST_REPORT_TEXT_LIMITS.title} caracteres).`,
      );
    }
    const description = optionalText(
      input.description,
      LOST_REPORT_TEXT_LIMITS.description,
    );
    if (description === undefined) {
      throw invalid(
        `Os detalhes têm até ${LOST_REPORT_TEXT_LIMITS.description} caracteres.`,
      );
    }
    const lostLocation = optionalText(
      input.lostLocation,
      LOST_REPORT_TEXT_LIMITS.lostLocation,
    );
    if (lostLocation === undefined) {
      throw invalid(
        `O local tem até ${LOST_REPORT_TEXT_LIMITS.lostLocation} caracteres.`,
      );
    }
    const lostOn = input.lostOn?.trim() || null;
    if (lostOn !== null) {
      const today = toLocalDate(this.clock.now(), this.clock.timeZone);
      if (!isLocalDate(lostOn) || lostOn > today) {
        throw invalid("O dia em que perdeu não pode estar no futuro.");
      }
    }
    const photoKey = input.photo
      ? await this.storePhoto(condominiumId, input.photo)
      : null;
    try {
      return await this.reports.create({
        condominiumId,
        userId: actor.id,
        category: input.category,
        title,
        description,
        lostLocation,
        lostOn,
        photoKey,
        shared: input.shared ?? false,
      });
    } catch (error) {
      if (photoKey) {
        await this.storage.deleteMany([photoKey]).catch((cause) => {
          this.logger.warn(`Lost report photo not removed: ${String(cause)}`);
        });
      }
      throw error;
    }
  }

  /** Shrunk and stored as WebP, as a found item's photo. */
  private async storePhoto(condominiumId: string, base64: string) {
    const raw = decodeBase64Image(base64, FOUND_ITEM_PHOTO_MAX_BYTES);
    const image = raw
      ? await this.images.spacePhoto(raw, {
          maxBytes: FOUND_ITEM_PHOTO_MAX_BYTES,
          maxSide: FOUND_ITEM_PHOTO_MAX_SIDE,
        })
      : null;
    if (!image) {
      throw AppException.from(APP_ERRORS.lostFound.invalidPhoto, undefined);
    }
    const key = `lost-report-photos/${condominiumId}/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    return key;
  }

  /** The resident ends their open report: got it back, or gave up. */
  async close(
    actor: AuthenticatedUser,
    id: string,
    found: boolean,
  ): Promise<LostReport> {
    const condominiumId = await this.access.condominiumOf(actor);
    const report = await this.reports.find(condominiumId, id);
    if (!report || report.userId !== actor.id) {
      throw AppException.from(APP_ERRORS.lostFound.reportNotFound, undefined);
    }
    const closed = await this.reports.close(
      id,
      actor.id,
      found ? LostReportStatus.FOUND : LostReportStatus.CANCELLED,
      this.clock.now(),
    );
    if (!closed) {
      throw AppException.from(APP_ERRORS.lostFound.reportClosed, undefined);
    }
    return closed;
  }
}
