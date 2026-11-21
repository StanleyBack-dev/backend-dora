import type {
  FoundItem,
  FoundItemClaim,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import type { CheckedReturn } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import type { FoundItemClaimType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-claim.output";
import type { FoundItemReturnType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-return.output";
import type { FoundItemType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item.output";
import { maskDocument } from "@/shared/domain/signature/signature-capture";

export function toFoundItemType(item: FoundItem): FoundItemType {
  return {
    id: item.id,
    condominiumId: item.condominiumId,
    category: item.category,
    title: item.title,
    description: item.description,
    privateDetailsRaw: item.privateDetails,
    foundLocation: item.foundLocation,
    foundAt: item.foundAt,
    storageLocation: item.storageLocation,
    photoKey: item.photoKey,
    photoHidden: item.photoHidden,
    status: item.status,
    registeredByName: item.registeredByName,
    keepUntil: item.keepUntil,
    closedAt: item.closedAt,
    closedByName: item.closedByName,
    closeReason: item.closeReason,
    returnedToId: item.returnedToId,
    returnedToNameRaw: item.returnedToName,
    signerNameRaw: item.signerName,
    pendingClaims: item.pendingClaims,
    awaitedByNameRaw: item.awaitedByName,
    ownerUnitLabel: item.ownerUnitLabel,
    ownerName: item.ownerUserName,
  };
}

export const toClaimType = (claim: FoundItemClaim): FoundItemClaimType => ({
  id: claim.id,
  itemId: claim.itemId,
  itemTitle: claim.itemTitle,
  itemStatus: claim.itemStatus,
  itemCategory: claim.itemCategory,
  userId: claim.userId,
  userName: claim.userName,
  unitLabel: claim.unitLabel,
  message: claim.message,
  status: claim.status,
  createdAt: claim.createdAt,
  decidedAt: claim.decidedAt,
  decidedByName: claim.decidedByName,
  decisionNote: claim.decisionNote,
});

export function toReturnType(
  record: CheckedReturn,
  imageUrl: string,
): FoundItemReturnType {
  return {
    claimId: record.claimId,
    signerName: record.signerName,
    signerDocumentType: record.signerDocumentType,
    signerDocumentMasked:
      record.signerDocumentType && record.signerDocument
        ? maskDocument(record.signerDocumentType, record.signerDocument)
        : null,
    declaration: record.declaration,
    imageUrl,
    imageSha256: record.imageSha256,
    strokesSha256: record.strokesSha256,
    signedAt: record.signedAt,
    clientSignedAt: record.clientSignedAt,
    clientTimeZone: record.clientTimeZone,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    device: JSON.stringify(record.device),
    locationStatus: record.location.status,
    latitude: record.location.latitude,
    longitude: record.location.longitude,
    locationAccuracyMeters: record.location.accuracyMeters,
    collectedByName: record.collectedByName,
    collectedByRole: record.collectedByRole,
    evidenceSha256: record.evidenceSha256,
    intact: record.intact,
    selfHandover: record.selfHandover,
  };
}
