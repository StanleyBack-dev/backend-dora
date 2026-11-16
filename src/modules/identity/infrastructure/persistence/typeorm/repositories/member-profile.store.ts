import type { EntityManager } from "typeorm";
import {
  MemberKind,
  type MemberProfile,
} from "@/modules/identity/domain/member-profile";
import { EmployeeOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/employee.orm-entity";
import { MembershipOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity";
import { ResidentOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/resident.orm-entity";

// The resident / employee record of a membership, kept in step with the
// membership's kind. Run inside the caller's transaction.

export async function readProfile(
  manager: EntityManager,
  membershipId: string,
  kind: MemberKind,
): Promise<MemberProfile> {
  if (kind === MemberKind.EMPLOYEE) {
    const row = await manager
      .getRepository(EmployeeOrmEntity)
      .findOne({ where: { membershipId } });
    return {
      kind: MemberKind.EMPLOYEE,
      jobTitle: row?.jobTitle ?? null,
      hiredOn: row?.hiredOn ?? null,
      workShift: row?.workShift ?? null,
      contractor: row?.contractor ?? null,
    };
  }
  const row = await manager
    .getRepository(ResidentOrmEntity)
    .findOne({ where: { membershipId } });
  return {
    kind: MemberKind.RESIDENT,
    unitId: row?.unitId ?? null,
    unitComplement: row?.unitComplement ?? null,
  };
}

/**
 * Writes the record for `profile`. When the kind changes, the old record
 * goes first (the composite FK forbids a record of the other kind), then
 * the membership's kind, then the new record.
 */
export async function writeProfile(
  manager: EntityManager,
  membershipId: string,
  profile: MemberProfile,
  currentKind: MemberKind | null,
): Promise<void> {
  if (currentKind !== null && currentKind !== profile.kind) {
    const old =
      currentKind === MemberKind.EMPLOYEE
        ? EmployeeOrmEntity
        : ResidentOrmEntity;
    await manager.getRepository(old).delete({ membershipId });
    await manager
      .getRepository(MembershipOrmEntity)
      .update({ id: membershipId }, { kind: profile.kind });
  }
  if (profile.kind === MemberKind.EMPLOYEE) {
    await manager.getRepository(EmployeeOrmEntity).save({
      membershipId,
      jobTitle: profile.jobTitle,
      hiredOn: profile.hiredOn,
      workShift: profile.workShift,
      contractor: profile.contractor,
    });
  } else {
    await manager.getRepository(ResidentOrmEntity).save({
      membershipId,
      unitId: profile.unitId,
      unitComplement: profile.unitComplement,
    });
  }
}

/** A new membership with its record. */
export async function insertMembership(
  manager: EntityManager,
  membership: {
    userId: string;
    condominiumId: string;
    role: MembershipOrmEntity["role"];
    profile: MemberProfile;
  },
): Promise<MembershipOrmEntity> {
  const repository = manager.getRepository(MembershipOrmEntity);
  const row = await repository.save(
    repository.create({
      userId: membership.userId,
      condominiumId: membership.condominiumId,
      role: membership.role,
      kind: membership.profile.kind,
    }),
  );
  await writeProfile(manager, row.id, membership.profile, null);
  return row;
}
