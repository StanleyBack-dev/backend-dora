import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { PermissionsService } from "@/modules/access-control/application/permissions.service";
import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import type { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import type {
  Parcel,
  ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";

const parcel = (recipientUserId: string | null) =>
  ({
    condominiumId: "condo-1",
    unitId: "unit-1",
    recipientUserId,
  }) as Parcel;

function setup(residents = ["resident-1", "resident-2"]) {
  const users = {
    memberUnitId: async () => "unit-1",
    activeUnitMemberIds: async () => residents,
  } as unknown as UserLookupService;
  const permissions = {
    effectiveFor: async () => new Set(),
  } as unknown as PermissionsService;
  return new ParcelAccessService(
    {} as ParcelRepositoryPort,
    {} as ModuleAccessService,
    permissions,
    users,
  );
}

const resident = (id: string) => ({ id }) as AuthenticatedUser;

describe("ParcelAccessService", () => {
  it("shows a unit parcel to every resident of the unit", async () => {
    const access = setup();
    await expect(
      access.canSee(resident("resident-2"), parcel(null)),
    ).resolves.toBe(true);
  });

  it("shows a parcel registered by name only to that resident", async () => {
    const access = setup();
    const surprise = parcel("resident-1");
    await expect(access.canSee(resident("resident-1"), surprise)).resolves.toBe(
      true,
    );
    await expect(access.canSee(resident("resident-2"), surprise)).resolves.toBe(
      false,
    );
  });

  it("tells only the chosen resident, or the whole unit", async () => {
    const access = setup();
    await expect(access.audience(parcel("resident-1"))).resolves.toEqual([
      "resident-1",
    ]);
    await expect(access.audience(parcel(null))).resolves.toEqual([
      "resident-1",
      "resident-2",
    ]);
  });

  it("tells the whole unit when the chosen resident moved out", async () => {
    const access = setup(["resident-2"]);
    await expect(access.audience(parcel("resident-1"))).resolves.toEqual([
      "resident-2",
    ]);
  });
});
