import type { Parcel } from "@/modules/parcels/application/ports/parcel-repository.port";
import type { CheckedSignature } from "@/modules/parcels/application/use-cases/get-parcel-signature.use-case";
import type { ParcelSignatureType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel-signature.output";
import type { ParcelType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel.output";
import {
  DocumentType,
  formatDocument,
} from "@/shared/domain/identity-document";

export function toParcelType(parcel: Parcel): ParcelType {
  return {
    id: parcel.id,
    condominiumId: parcel.condominiumId,
    unitId: parcel.unitId,
    unitLabel: parcel.unitLabel,
    recipientName: parcel.recipientName,
    recipientOnly: parcel.recipientUserId !== null,
    carrier: parcel.carrier,
    trackingCode: parcel.trackingCode,
    notes: parcel.notes,
    storageLocation: parcel.storageLocation,
    pickupCode: parcel.pickupCode,
    status: parcel.status,
    receivedAt: parcel.receivedAt,
    receivedByName: parcel.receivedByName,
    closedAt: parcel.closedAt,
    closedByName: parcel.closedByName,
    closeReason: parcel.closeReason,
    signerName: parcel.signerName,
    photoKey: parcel.photoKey,
  };
}

/** Only the middle of the document shows: enough to recognise, not to reuse. */
export function maskDocument(type: DocumentType, value: string): string {
  const formatted = formatDocument(type, value);
  if (type === DocumentType.CPF) {
    return `***.${formatted.slice(4, 11)}-**`;
  }
  return `${value.slice(0, 2)}${"*".repeat(value.length - 3)}${value.slice(-1)}`;
}

export function toSignatureType(
  signature: CheckedSignature,
  imageUrl: string,
): ParcelSignatureType {
  return {
    signerName: signature.signerName,
    signerDocumentType: signature.signerDocumentType,
    signerDocumentMasked:
      signature.signerDocumentType && signature.signerDocument
        ? maskDocument(signature.signerDocumentType, signature.signerDocument)
        : null,
    declaration: signature.declaration,
    imageUrl,
    imageSha256: signature.imageSha256,
    drawing: JSON.stringify(signature.drawing),
    strokesSha256: signature.strokesSha256,
    signedAt: signature.signedAt,
    clientSignedAt: signature.clientSignedAt,
    clientTimeZone: signature.clientTimeZone,
    ipAddress: signature.ipAddress,
    userAgent: signature.userAgent,
    device: JSON.stringify(signature.device),
    locationStatus: signature.location.status,
    latitude: signature.location.latitude,
    longitude: signature.location.longitude,
    locationAccuracyMeters: signature.location.accuracyMeters,
    collectedByName: signature.collectedByName,
    collectedByRole: signature.collectedByRole,
    evidenceSha256: signature.evidenceSha256,
    intact: signature.intact,
  };
}
