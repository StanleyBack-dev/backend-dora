import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import {
  RETURN_RECEIPT_RENDERER,
  type ReturnReceiptRendererPort,
} from "@/modules/lost-and-found/application/ports/return-receipt-renderer.port";
import { GetReturnReceiptUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import { FoundItemStatus } from "@/modules/lost-and-found/domain/found-item";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { maskDocument } from "@/shared/domain/signature/signature-capture";

export type ReturnReceiptFile = {
  fileName: string;
  mimeType: string;
  /** The PDF in base64. */
  base64Content: string;
};

/** "Blusa vermelha!" → "blusa-vermelha". */
const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item";

// The return receipt as a PDF, for whoever sees the return (the staff, or
// the resident it went back to): the item, the signature with its evidence
// and whether the record is still intact, and a QR to the item in the app.
@Injectable()
export class GetReturnReceiptPdfUseCase {
  private readonly logger = new Logger(GetReturnReceiptPdfUseCase.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly access: LostFoundAccessService,
    private readonly receipts: GetReturnReceiptUseCase,
    private readonly condominiums: CondominiumLookupService,
    @Inject(RETURN_RECEIPT_RENDERER)
    private readonly renderer: ReturnReceiptRendererPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>("FRONTEND_URL") ?? "").replace(
      /\/+$/,
      "",
    );
  }

  async execute(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<ReturnReceiptFile> {
    const item = await this.access.loadVisible(actor, id);
    const signature =
      item.status === FoundItemStatus.RETURNED &&
      (await this.access.seesReturn(actor, item))
        ? await this.receipts.execute(item.id)
        : null;
    if (!signature) {
      throw AppException.from(APP_ERRORS.lostFound.noReceipt, undefined);
    }
    const [condominium, signaturePng] = await Promise.all([
      this.condominiums.find(item.condominiumId),
      this.storage.get(signature.imageKey).catch((error) => {
        this.logger.warn(`Signature image not read: ${String(error)}`);
        return null;
      }),
    ]);

    const pdf = await this.renderer.render({
      condominiumName: condominium?.name ?? "Condomínio",
      item,
      signature,
      signerDocumentMasked:
        signature.signerDocumentType && signature.signerDocument
          ? maskDocument(signature.signerDocumentType, signature.signerDocument)
          : null,
      signaturePng,
      receiptUrl: `${this.frontendUrl}/achados-e-perdidos/${item.id}`,
      issuedAt: this.clock.now(),
      timeZone: this.clock.timeZone,
    });
    return {
      fileName: `comprovante-devolucao-${slug(item.title)}.pdf`,
      mimeType: "application/pdf",
      base64Content: pdf.toString("base64"),
    };
  }
}
