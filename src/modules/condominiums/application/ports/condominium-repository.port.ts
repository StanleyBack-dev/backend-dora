import type { AppModule } from "@/modules/condominiums/domain/app-module";
import type {
  Condominium,
  CondominiumDraft,
  CondominiumStatus,
} from "@/modules/condominiums/domain/condominium";

/** A condominium with the numbers the platform console shows. */
export type CondominiumSummary = Condominium & {
  /** Active members with an active account. */
  activeMembers: number;
  managers: number;
  units: number;
  pendingEnrollments: number;
  /** Optional modules turned on (contracted apart). */
  modules: AppModule[];
  /** Most recent sign-in of any of its members. */
  lastActivityAt: Date | null;
};

export type CondominiumFilter = {
  /** Name or city, accent-insensitive. */
  search?: string;
  status?: CondominiumStatus;
};

/** The format is optional: a new condominium defaults to apartments. */
export type CondominiumData = Required<
  Omit<CondominiumDraft, "addressFormat">
> &
  Pick<CondominiumDraft, "addressFormat">;

export interface CondominiumRepositoryPort {
  list(filter: CondominiumFilter): Promise<CondominiumSummary[]>;
  findSummary(id: string): Promise<CondominiumSummary | null>;
  findById(id: string): Promise<Condominium | null>;
  findByDocument(document: string): Promise<Condominium | null>;
  create(data: CondominiumData): Promise<Condominium>;
  update(
    id: string,
    patch: Partial<CondominiumData> & { status?: CondominiumStatus },
  ): Promise<Condominium>;
}

export const CONDOMINIUM_REPOSITORY = Symbol("CONDOMINIUM_REPOSITORY");
