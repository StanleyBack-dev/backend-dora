import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import {
  PARCEL_RECEIPT_RENDERER,
  type ParcelReceiptRendererPort,
} from "@/modules/parcels/application/ports/parcel-receipt-renderer.port";
import { GetParcelSignatureUseCase } from "@/modules/parcels/application/use-cases/get-parcel-signature.use-case";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { maskDocument } from "@/modules/parcels/domain/parcel-signature";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

export type ReceiptFile = {
  fileName: string;
  mimeType: string;
  /** The PDF in base64. */
  base64Content: string;
};

// The pickup receipt as a PDF (who may see the parcel may download it): the
// parcel, the signature with its evidence and whether the record is still
// intact, and a QR to the receipt in the app.
@Injectable()
export class GetParcelReceiptPdfUseCase {
  private readonly logger = new Logger(GetParcelReceiptPdfUseCase.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly access: ParcelAccessService,
    private readonly signatures: GetParcelSignatureUseCase,
    private readonly condominiums: CondominiumLookupService,
    @Inject(PARCEL_RECEIPT_RENDERER)
    private readonly renderer: ParcelReceiptRendererPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>("FRONTEND_URL") ?? "").replace(
      /\/+$/,
      "",
    );
  }

  async execute(actor: AuthenticatedUser, id: string): Promise<ReceiptFile> {
    const parcel = await this.access.loadVisible(actor, id);
    const signature =
      parcel.status === ParcelStatus.PICKED_UP
        ? await this.signatures.execute(parcel.id)
        : null;
    if (!signature) {
      throw AppException.from(APP_ERRORS.parcels.noReceipt, undefined);
    }
    const [condominium, signaturePng] = await Promise.all([
      this.condominiums.find(parcel.condominiumId),
      this.storage.get(signature.imageKey).catch((error) => {
        this.logger.warn(`Signature image not read: ${String(error)}`);
        return null;
      }),
    ]);

    const pdf = await this.renderer.render({
      condominiumName: condominium?.name ?? "Condomínio",
      parcel,
      signature,
      signerDocumentMasked:
        signature.signerDocumentType && signature.signerDocument
          ? maskDocument(signature.signerDocumentType, signature.signerDocument)
          : null,
      signaturePng,
      receiptUrl: `${this.frontendUrl}/encomendas/${parcel.id}`,
      issuedAt: this.clock.now(),
      timeZone: this.clock.timeZone,
    });
    return {
      fileName: `comprovante-encomenda-${parcel.pickupCode}.pdf`,
      mimeType: "application/pdf",
      base64Content: pdf.toString("base64"),
    };
  }
}
