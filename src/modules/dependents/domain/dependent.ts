import { normalizeBirthDate } from "@/shared/domain/birth-date";

// A dependent: someone of a resident's household who doesn't use the app (a
// child, a spouse…), registered once with a document proving the birth
// date. The managers approve it once; from then on the resident picks the
// dependent in any event order and the age comes from the birth date.

export enum DependentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum DependentRelationship {
  CHILD = "CHILD",
  SPOUSE = "SPOUSE",
  PARENT = "PARENT",
  SIBLING = "SIBLING",
  GRANDCHILD = "GRANDCHILD",
  OTHER = "OTHER",
}

export const RELATIONSHIP_LABELS: Record<DependentRelationship, string> = {
  [DependentRelationship.CHILD]: "Filho(a)",
  [DependentRelationship.SPOUSE]: "Cônjuge",
  [DependentRelationship.PARENT]: "Pai/Mãe",
  [DependentRelationship.SIBLING]: "Irmão(ã)",
  [DependentRelationship.GRANDCHILD]: "Neto(a)",
  [DependentRelationship.OTHER]: "Outro",
};

export type Dependent = {
  id: string;
  condominiumId: string;
  /** The resident who registered it. */
  membershipId: string;
  /** That resident's name (for the managers). */
  holderName: string | null;
  unitLabel: string | null;
  name: string;
  /** YYYY-MM-DD. */
  birthDate: string;
  relationship: DependentRelationship;
  documentKey: string;
  documentContentType: string;
  status: DependentStatus;
  reviewedAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
};

export type DependentInput = {
  name: string;
  birthDate: string;
  relationship: DependentRelationship;
};

export type DependentData = DependentInput;

export const DEPENDENT_NAME_MIN = 3;
export const DEPENDENT_NAME_MAX = 80;
/** Per resident: a household, not a guest list. */
export const DEPENDENTS_MAX = 15;
export const REJECT_REASON_MIN = 3;
export const REJECT_REASON_MAX = 300;

export type DependentViolation = "name" | "birth-date" | "relationship";

export const DEPENDENT_VIOLATION_MESSAGES: Record<DependentViolation, string> =
  {
    name: `Informe o nome completo (${DEPENDENT_NAME_MIN} a ${DEPENDENT_NAME_MAX} letras).`,
    "birth-date": "Data de nascimento inválida (de 1900 até hoje).",
    relationship: "Escolha o parentesco.",
  };

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** Checked and trimmed (`today`: YYYY-MM-DD); the first problem otherwise. */
export function normalizeDependent(
  input: DependentInput,
  today: string,
): DependentData | DependentViolation {
  const name = collapse(input.name);
  if (name.length < DEPENDENT_NAME_MIN || name.length > DEPENDENT_NAME_MAX) {
    return "name";
  }
  const birthDate = normalizeBirthDate(input.birthDate, today);
  if (!birthDate) return "birth-date";
  if (!Object.values(DependentRelationship).includes(input.relationship)) {
    return "relationship";
  }
  return { name, birthDate, relationship: input.relationship };
}

/** Trimmed reason; null when too short or too long. */
export function normalizeDependentRejectReason(value: string): string | null {
  const reason = collapse(value);
  return reason.length >= REJECT_REASON_MIN &&
    reason.length <= REJECT_REASON_MAX
    ? reason
    : null;
}
