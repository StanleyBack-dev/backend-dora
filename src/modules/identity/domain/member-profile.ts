/**
 * How a person is tied to a condominium, apart from their role there (the
 * role only sets permissions): a resident lives in a unit; an employee
 * works there and has a staff record (the base for a future time sheet).
 * A manager can be either: a resident síndico or a hired one.
 */
export enum MemberKind {
  RESIDENT = "RESIDENT",
  EMPLOYEE = "EMPLOYEE",
}

export type ResidentProfile = {
  kind: MemberKind.RESIDENT;
  unitId: string | null;
  /** Address detail inside the condominium ("casa dos fundos"). */
  unitComplement: string | null;
};

export type EmployeeProfile = {
  kind: MemberKind.EMPLOYEE;
  /** "Porteiro", "Zelador", "Síndico profissional"… */
  jobTitle: string | null;
  /** Hiring date, YYYY-MM-DD. */
  hiredOn: string | null;
  /** "Diurno 7h–19h", "12x36"… */
  workShift: string | null;
  /** The outsourcing company, when not hired by the condominium. */
  contractor: string | null;
};

export type MemberProfile = ResidentProfile | EmployeeProfile;

export type EmployeeProfileInput = {
  jobTitle?: string | null;
  hiredOn?: string | null;
  workShift?: string | null;
  contractor?: string | null;
};

export const EMPLOYEE_LIMITS = {
  jobTitle: 60,
  workShift: 80,
  contractor: 120,
} as const;

export type EmployeeViolation =
  "jobTitle" | "workShift" | "contractor" | "hiredOn";

export const EMPLOYEE_VIOLATION_MESSAGES: Record<EmployeeViolation, string> = {
  jobTitle: `O cargo deve ter até ${EMPLOYEE_LIMITS.jobTitle} caracteres.`,
  workShift: `O turno deve ter até ${EMPLOYEE_LIMITS.workShift} caracteres.`,
  contractor: `A empresa deve ter até ${EMPLOYEE_LIMITS.contractor} caracteres.`,
  hiredOn: "Data de admissão inválida (não pode ser no futuro).",
};

export const residentProfile = (
  unitId: string | null = null,
  unitComplement: string | null = null,
): ResidentProfile => ({ kind: MemberKind.RESIDENT, unitId, unitComplement });

export const EMPTY_EMPLOYEE: EmployeeProfile = {
  kind: MemberKind.EMPLOYEE,
  jobTitle: null,
  hiredOn: null,
  workShift: null,
  contractor: null,
};

/** The unit, for residents (employees have none). */
export const profileUnitId = (profile: MemberProfile): string | null =>
  profile.kind === MemberKind.RESIDENT ? profile.unitId : null;

const text = (
  value: string | null | undefined,
  max: number,
): string | null | "too-long" => {
  const clean = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!clean) return null;
  return clean.length > max ? "too-long" : clean;
};

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date, from 1950 up to `today` (YYYY-MM-DD). */
function hiringDate(
  value: string | null | undefined,
  today: string,
): string | null | "invalid" {
  const clean = value?.trim() ?? "";
  if (!clean) return null;
  const match = DATE.exec(clean);
  if (!match) return "invalid";
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const real =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;
  if (!real || y < 1950 || clean > today) return "invalid";
  return clean;
}

/**
 * The employee record from what was typed: every field optional, trimmed,
 * within its limit; the hiring date can't be in the future.
 */
export function normalizeEmployee(
  input: EmployeeProfileInput,
  today: string,
): EmployeeProfile | { violation: EmployeeViolation } {
  const jobTitle = text(input.jobTitle, EMPLOYEE_LIMITS.jobTitle);
  if (jobTitle === "too-long") return { violation: "jobTitle" };
  const workShift = text(input.workShift, EMPLOYEE_LIMITS.workShift);
  if (workShift === "too-long") return { violation: "workShift" };
  const contractor = text(input.contractor, EMPLOYEE_LIMITS.contractor);
  if (contractor === "too-long") return { violation: "contractor" };
  const hiredOn = hiringDate(input.hiredOn, today);
  if (hiredOn === "invalid") return { violation: "hiredOn" };
  return {
    kind: MemberKind.EMPLOYEE,
    jobTitle,
    hiredOn,
    workShift,
    contractor,
  };
}
