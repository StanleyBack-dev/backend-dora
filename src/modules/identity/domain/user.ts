import type { UserGroup } from "@/modules/access-control/domain/user-group";

export type User = {
  id: string;
  name: string;
  email: string;
  /** Login name: lowercase, see username.ts. */
  username: string;
  group: UserGroup;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt: Date | null;
  lastLoginAt: Date | null;
  /** Contact phone, digits only (DDD + number; null: not informed). */
  phone: string | null;
  /** YYYY-MM-DD (null: not informed); prices event tickets by age. */
  birthDate: string | null;
  /** Profile photo in the object storage (null: none). */
  avatarKey: string | null;
  /**
   * Condominium the person worked in last; a new login reopens it while they
   * can still enter it (null: none chosen, or the platform view).
   */
  lastCondominiumId: string | null;
  /** When the guided tour was finished or skipped (null: not yet). */
  onboardingCompletedAt: Date | null;
};

/** Login state kept apart from the profile (tb_auth_credentials). */
export type Credential = {
  userId: string;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
};
