import {
  GROUP_DEFAULT_PERMISSIONS,
  LOCKED_PERMISSIONS,
} from "@/modules/access-control/domain/group-permissions";
import {
  ALL_PERMISSIONS,
  Permission,
} from "@/modules/access-control/domain/permission";
import {
  canAssignGroup,
  checkManagement,
  planOverrides,
  resolvePermissionMatrix,
} from "@/modules/access-control/domain/permission-policy";
import { UserGroup } from "@/modules/access-control/domain/user-group";

describe("group defaults", () => {
  it("lets residents book spaces", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.USER]).toEqual([
      Permission.BOOKINGS_CREATE,
    ]);
  });

  it("lets a manager (ADMIN) run their condominium", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN]).toEqual([
      Permission.BOOKINGS_CREATE,
      Permission.DASHBOARD_READ,
      Permission.NOTIFICATIONS_BROADCAST,
      Permission.USERS_MANAGE,
      Permission.PERMISSIONS_MANAGE,
      Permission.UNITS_MANAGE,
      Permission.SPACES_MANAGE,
      Permission.BOOKINGS_MANAGE,
    ]);
  });

  it("gives ADMIN_MASTER everything", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER]).toEqual(
      ALL_PERMISSIONS,
    );
  });

  it("keeps history, support and condominiums with the platform", () => {
    for (const permission of [
      Permission.AUDIT_READ,
      Permission.SUPPORT_MANAGE,
      Permission.CONDOMINIUMS_MANAGE,
    ]) {
      expect(LOCKED_PERMISSIONS.has(permission)).toBe(true);
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN]).not.toContain(
        permission,
      );
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER]).toContain(
        permission,
      );
    }
  });

  it("never lets an override grant member or permission management", () => {
    for (const permission of [
      Permission.USERS_MANAGE,
      Permission.PERMISSIONS_MANAGE,
    ]) {
      expect(LOCKED_PERMISSIONS.has(permission)).toBe(true);
      expect(
        resolvePermissionMatrix(UserGroup.USER, [{ permission, allowed: true }])
          .effective,
      ).not.toContain(permission);
    }
  });

  it("ignores a stored per-member grant of a locked permission", () => {
    const matrix = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.AUDIT_READ, allowed: true },
    ]);
    expect(matrix.effective).not.toContain(Permission.AUDIT_READ);
  });
});

describe("resolvePermissionMatrix", () => {
  it("applies grants and revocations on top of the group", () => {
    const matrix = resolvePermissionMatrix(UserGroup.ADMIN, [
      { permission: Permission.NOTIFICATIONS_BROADCAST, allowed: false },
    ]);
    expect(matrix.effective).not.toContain(Permission.NOTIFICATIONS_BROADCAST);
    expect(matrix.overrides).toHaveLength(1);

    const resident = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.DASHBOARD_READ, allowed: true },
    ]);
    expect(resident.effective).toEqual([
      Permission.DASHBOARD_READ,
      Permission.BOOKINGS_CREATE,
    ]);

    // A manager can take booking away from one resident (e.g. overdue fees).
    const blocked = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.BOOKINGS_CREATE, allowed: false },
    ]);
    expect(blocked.effective).toEqual([]);
  });

  it("ignores overrides on locked permissions and no-op overrides", () => {
    const matrix = resolvePermissionMatrix(UserGroup.ADMIN, [
      { permission: Permission.AUDIT_READ, allowed: true },
      { permission: Permission.USERS_MANAGE, allowed: false },
      { permission: Permission.DASHBOARD_READ, allowed: true },
    ]);
    expect(matrix.effective).not.toContain(Permission.AUDIT_READ);
    expect(matrix.effective).toContain(Permission.USERS_MANAGE);
    expect(matrix.overrides).toEqual([]);
  });

  it("lists permissions in catalog order", () => {
    const matrix = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.NOTIFICATIONS_BROADCAST, allowed: true },
      { permission: Permission.DASHBOARD_READ, allowed: true },
    ]);
    expect(matrix.effective).toEqual([
      Permission.DASHBOARD_READ,
      Permission.NOTIFICATIONS_BROADCAST,
      Permission.BOOKINGS_CREATE,
    ]);
  });
});

describe("planOverrides", () => {
  it("stores only the differences from the group", () => {
    expect(
      planOverrides(
        UserGroup.ADMIN,
        GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN].filter(
          (p) => p !== Permission.DASHBOARD_READ,
        ),
      ),
    ).toEqual({
      ok: true,
      overrides: [{ permission: Permission.DASHBOARD_READ, allowed: false }],
    });
  });

  it("refuses to grant or revoke a locked permission", () => {
    expect(
      planOverrides(UserGroup.ADMIN, [
        ...GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN],
        Permission.AUDIT_READ,
      ]),
    ).toEqual({ ok: false, lockedChanges: [Permission.AUDIT_READ] });

    expect(
      planOverrides(
        UserGroup.ADMIN_MASTER,
        GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER].filter(
          (p) => p !== Permission.PERMISSIONS_MANAGE,
        ),
      ),
    ).toEqual({ ok: false, lockedChanges: [Permission.PERMISSIONS_MANAGE] });
  });

  it("round-trips through resolvePermissionMatrix", () => {
    const desired = [Permission.NOTIFICATIONS_BROADCAST];
    const plan = planOverrides(UserGroup.USER, desired);
    if (!plan.ok) throw new Error("expected a valid plan");
    const effective = resolvePermissionMatrix(
      UserGroup.USER,
      plan.overrides,
    ).effective;
    expect([...effective].sort()).toEqual([...desired].sort());
  });
});

describe("management rules", () => {
  const master = { id: "m", group: UserGroup.ADMIN_MASTER };
  const admin = { id: "a", group: UserGroup.ADMIN };
  const user = { id: "u", group: UserGroup.USER };

  it("never lets someone manage themselves", () => {
    expect(checkManagement(master, { ...master })).toBe("self");
  });

  it("lets a master manage anyone else, including other masters", () => {
    expect(
      checkManagement(master, { id: "m2", group: UserGroup.ADMIN_MASTER }),
    ).toBeNull();
    expect(checkManagement(master, admin)).toBeNull();
  });

  it("lets other groups manage only lower ranks", () => {
    expect(checkManagement(admin, user)).toBeNull();
    expect(checkManagement(admin, { id: "a2", group: UserGroup.ADMIN })).toBe(
      "insufficient-rank",
    );
    expect(checkManagement(admin, master)).toBe("insufficient-rank");
    expect(checkManagement(user, { id: "u2", group: UserGroup.USER })).toBe(
      "insufficient-rank",
    );
  });

  it("limits which groups can be assigned", () => {
    expect(canAssignGroup(UserGroup.ADMIN, UserGroup.USER)).toBe(true);
    expect(canAssignGroup(UserGroup.ADMIN, UserGroup.ADMIN)).toBe(false);
    expect(canAssignGroup(UserGroup.ADMIN_MASTER, UserGroup.ADMIN_MASTER)).toBe(
      true,
    );
  });
});
