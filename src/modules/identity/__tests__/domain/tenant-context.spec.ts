import { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  resolveTenantContext,
  type SessionTenant,
} from "@/modules/identity/domain/membership";

const member: SessionTenant = {
  accountGroup: UserGroup.USER,
  condominiumId: "condo-1",
  condominiumStatus: "ACTIVE",
  membershipId: "membership-1",
  membershipRole: UserGroup.ADMIN,
};

const outside = {
  group: UserGroup.USER,
  platformAdmin: false,
  condominiumId: null,
  membershipId: null,
};

describe("resolveTenantContext", () => {
  it("gives a member their role in the session's condominium", () => {
    expect(resolveTenantContext(member)).toEqual({
      group: UserGroup.ADMIN,
      platformAdmin: false,
      condominiumId: "condo-1",
      membershipId: "membership-1",
    });
  });

  it("leaves someone without an active membership outside", () => {
    expect(
      resolveTenantContext({
        ...member,
        membershipId: null,
        membershipRole: null,
      }),
    ).toEqual(outside);
  });

  it("closes a suspended or deleted condominium to its members", () => {
    expect(
      resolveTenantContext({ ...member, condominiumStatus: "SUSPENDED" }),
    ).toEqual(outside);
    expect(
      resolveTenantContext({ ...member, condominiumStatus: null }),
    ).toEqual(outside);
  });

  it("lets the platform administrator into any condominium, as the platform", () => {
    expect(
      resolveTenantContext({
        ...member,
        accountGroup: UserGroup.ADMIN_MASTER,
        condominiumStatus: "SUSPENDED",
      }),
    ).toEqual({
      group: UserGroup.ADMIN_MASTER,
      platformAdmin: true,
      condominiumId: "condo-1",
      membershipId: null,
    });
  });

  it("keeps the platform administrator's powers with no condominium", () => {
    expect(
      resolveTenantContext({
        accountGroup: UserGroup.ADMIN_MASTER,
        condominiumId: null,
        condominiumStatus: null,
        membershipId: null,
        membershipRole: null,
      }),
    ).toEqual({
      group: UserGroup.ADMIN_MASTER,
      platformAdmin: true,
      condominiumId: null,
      membershipId: null,
    });
  });
});
