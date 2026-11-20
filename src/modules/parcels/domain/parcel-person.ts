import {
  DocumentType,
  normalizeCpf,
  normalizeRg,
} from "@/shared/domain/identity-document";

/** Someone who picks up (or may pick up) a parcel. */
export type ParcelPerson = {
  name: string;
  documentType: DocumentType | null;
  document: string | null;
};

/**
 * Checks a name (3 to 120 letters, spaces collapsed) and an optional CPF or
 * RG; `who` words the errors ("de quem está retirando", "da pessoa
 * autorizada"). Returns the person or the reason it was refused.
 */
export function normalizePerson(
  input: {
    name: string;
    documentType?: DocumentType | null;
    document?: string | null;
  },
  who: string,
): { person: ParcelPerson } | { error: string } {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 120) {
    return { error: `Informe o nome completo ${who}.` };
  }
  const raw = input.document?.trim();
  if (!raw) return { person: { name, documentType: null, document: null } };
  const documentType = input.documentType ?? DocumentType.CPF;
  const document =
    documentType === DocumentType.CPF ? normalizeCpf(raw) : normalizeRg(raw);
  if (!document) {
    return {
      error:
        documentType === DocumentType.CPF
          ? "CPF inválido. Confira os números ou deixe em branco."
          : "RG inválido. Confira os números ou deixe em branco.",
    };
  }
  return { person: { name, documentType, document } };
}
