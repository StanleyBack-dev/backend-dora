import type { FoundItem } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import type { CheckedReturn } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";

/** Everything the return receipt shows, already checked and loaded. */
export type ReturnReceiptDocument = {
  condominiumName: string;
  item: FoundItem;
  signature: CheckedReturn;
  /** "***.456.789-**" (null: no document informed). */
  signerDocumentMasked: string | null;
  /** The signature image as stored (null: could not be read). */
  signaturePng: Buffer | null;
  /** The item in the app (a QR in the document). */
  receiptUrl: string;
  issuedAt: Date;
  /** The condominium's time zone, for every date. */
  timeZone: string;
};

export interface ReturnReceiptRendererPort {
  /** The receipt as a PDF file. */
  render(document: ReturnReceiptDocument): Promise<Buffer>;
}

export const RETURN_RECEIPT_RENDERER = Symbol("RETURN_RECEIPT_RENDERER");
