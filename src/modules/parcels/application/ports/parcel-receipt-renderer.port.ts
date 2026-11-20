import type { Parcel } from "@/modules/parcels/application/ports/parcel-repository.port";
import type { CheckedSignature } from "@/modules/parcels/application/use-cases/get-parcel-signature.use-case";

/** Everything the pickup receipt shows, already checked and loaded. */
export type ParcelReceiptDocument = {
  condominiumName: string;
  parcel: Parcel;
  signature: CheckedSignature;
  /** "***.456.789-**" (null: no document informed). */
  signerDocumentMasked: string | null;
  /** The signature image as stored (null: could not be read). */
  signaturePng: Buffer | null;
  /** The receipt in the app (a QR in the document). */
  receiptUrl: string;
  issuedAt: Date;
  /** The condominium's time zone, for every date. */
  timeZone: string;
};

export interface ParcelReceiptRendererPort {
  /** The receipt as a PDF file. */
  render(document: ParcelReceiptDocument): Promise<Buffer>;
}

export const PARCEL_RECEIPT_RENDERER = Symbol("PARCEL_RECEIPT_RENDERER");
