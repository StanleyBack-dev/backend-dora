import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type {
  MemberCondominium,
  Membership,
} from "@/modules/identity/domain/membership";

export type NewMembership = {
  userId: string;
  condominiumId: string;
  role: UserGroup;
  unitId: string | null;
};

export type MembershipPatch = Partial<
  Pick<Membership, "role" | "unitId" | "active">
>;

export interface MembershipRepositoryPort {
  find(userId: string, condominiumId: string): Promise<Membership | null>;
  create(membership: NewMembership): Promise<Membership>;
  update(id: string, patch: MembershipPatch): Promise<Membership>;
  /** Active memberships in active condominiums, by name. */
  listOpenable(userId: string): Promise<MemberCondominium[]>;
  /** Where a login lands: the condominium opened last, else the oldest. */
  defaultCondominiumId(userId: string): Promise<string | null>;
  touchSelected(userId: string, condominiumId: string, at: Date): Promise<void>;
  /** Memberships of this account in other condominiums (any state). */
  countElsewhere(userId: string, condominiumId: string): Promise<number>;
  /** Members with an active membership and an active account. */
  activeUserIds(condominiumId: string, role?: UserGroup): Promise<string[]>;
}

export const MEMBERSHIP_REPOSITORY = Symbol("MEMBERSHIP_REPOSITORY");
