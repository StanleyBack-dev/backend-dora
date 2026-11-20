// Lost and found (achados e perdidos): something found in the condominium,
// kept by the gate or the administration until its owner takes it back
// (with a signature on the screen) or the keeping period ends and it is
// donated or discarded.

export enum FoundItemStatus {
  /** Kept by the condominium, waiting for its owner. */
  FOUND = "FOUND",
  /** Taken back by its owner (signed). */
  RETURNED = "RETURNED",
  DONATED = "DONATED",
  DISCARDED = "DISCARDED",
}

export enum FoundItemCategory {
  DOCUMENT = "DOCUMENT",
  KEYS = "KEYS",
  ELECTRONICS = "ELECTRONICS",
  CLOTHING = "CLOTHING",
  ACCESSORY = "ACCESSORY",
  BAG = "BAG",
  TOY = "TOY",
  OTHER = "OTHER",
}

export const CATEGORY_LABELS: Record<FoundItemCategory, string> = {
  [FoundItemCategory.DOCUMENT]: "Documento",
  [FoundItemCategory.KEYS]: "Chaves",
  [FoundItemCategory.ELECTRONICS]: "Eletrônico",
  [FoundItemCategory.CLOTHING]: "Roupa ou calçado",
  [FoundItemCategory.ACCESSORY]: "Acessório",
  [FoundItemCategory.BAG]: "Bolsa, mochila ou carteira",
  [FoundItemCategory.TOY]: "Brinquedo",
  [FoundItemCategory.OTHER]: "Outro",
};

export enum ClaimStatus {
  /** Waiting for the staff to check it. */
  PENDING = "PENDING",
  /** The staff recognised the owner: they may come and take it. */
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  /** Cancelled by whoever made it. */
  WITHDRAWN = "WITHDRAWN",
}

/** Kept this long after being found (then donated or discarded). */
export const FOUND_ITEM_KEEP_DAYS = 90;
/** The staff is told this long before the keeping period ends. */
export const FOUND_ITEM_EXPIRY_NOTICE_DAYS = 7;
/** The photo is kept this long after the item left the condominium. */
export const FOUND_ITEM_PHOTO_RETENTION_DAYS = 90;

/** A document's photo is not shown to the residents by default (privacy). */
export const hidesPhotoByDefault = (category: FoundItemCategory) =>
  category === FoundItemCategory.DOCUMENT;

/** Limits of the free-text fields (characters). */
export const FOUND_ITEM_TEXT_LIMITS = {
  title: 80,
  description: 300,
  privateDetails: 300,
  foundLocation: 80,
  storageLocation: 60,
} as const;

export type FoundItemTextField = keyof typeof FOUND_ITEM_TEXT_LIMITS;

/** Every item says what it is, where it was found and where it is kept. */
export const FOUND_ITEM_REQUIRED_FIELDS: readonly FoundItemTextField[] = [
  "title",
  "foundLocation",
  "storageLocation",
];

/**
 * An optional text: trimmed, inner spaces collapsed, "" -> null; undefined
 * when it is longer than the field allows.
 */
export function optionalText(
  value: string | null | undefined,
  max: number,
): string | null | undefined {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= max ? text : undefined;
}

/** A reason or a note: 3 to 300 characters (null otherwise). */
export function normalizeNote(value: string | null | undefined) {
  const note = (value ?? "").trim().replace(/\s+/g, " ");
  return note.length >= 3 && note.length <= 300 ? note : null;
}

/** What a claim says about the item: 10 to 500 characters (null otherwise). */
export function normalizeClaimMessage(value: string | null | undefined) {
  const message = (value ?? "").trim().replace(/\s+/g, " ");
  return message.length >= 10 && message.length <= 500 ? message : null;
}

/** Only an item still kept can be claimed, returned, donated or discarded. */
export const isKept = (status: FoundItemStatus) =>
  status === FoundItemStatus.FOUND;

/** What the return declaration says about the item. */
export type DeclarationItem = {
  condominiumName: string;
  title: string;
  category: FoundItemCategory;
  foundLocation: string;
  /** "20/11/2026" in the condominium's time zone. */
  foundOn: string;
};

/**
 * The declaration shown before signing (the signer's name goes in front:
 * see `signedDeclaration`).
 */
export function returnDeclaration(item: DeclarationItem): string {
  return (
    `declaro que recebi do ${item.condominiumName} o item “${item.title}” ` +
    `(${CATEGORY_LABELS[item.category].toLowerCase()}), achado em ${item.foundLocation} em ${item.foundOn}, ` +
    "que é de minha propriedade (ou que estou autorizado(a) pelo dono a retirá-lo), " +
    "na data e hora deste registro, e que esta assinatura eletrônica, feita por mim nesta tela, " +
    "expressa minha concordância com esta declaração (Lei nº 14.063/2020 e MP nº 2.200-2/2001, art. 10, § 2º)."
  );
}
