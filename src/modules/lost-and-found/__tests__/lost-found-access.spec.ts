import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import type { FoundItem } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import { FoundItemStatus } from "@/modules/lost-and-found/domain/found-item";

const kept = (overrides: Partial<FoundItem> = {}) =>
  ({
    id: "item-1",
    condominiumId: "condo-1",
    status: FoundItemStatus.FOUND,
    ownerUnitId: null,
    ownerUserId: null,
    ...overrides,
  }) as FoundItem;

const who = (id: string) => ({ id }) as AuthenticatedUser;

// The real rules of who sees an item, over stubbed staff check, units and
// claims: "gate-1" manages; residents live in unit-1 or unit-2.
function access() {
  const service = Object.create(
    LostFoundAccessService.prototype,
  ) as LostFoundAccessService;
  const units: Record<string, string> = {
    "resident-1": "unit-1",
    "resident-2": "unit-1",
    "resident-3": "unit-2",
  };
  Object.assign(service, {
    canManage: async (actor: AuthenticatedUser) => actor.id === "gate-1",
    unitOf: async (actor: AuthenticatedUser) => units[actor.id] ?? null,
    items: { claimsOf: async () => [] },
    users: { activeUnitMemberIds: async () => ["resident-1", "resident-2"] },
  });
  return service;
}

describe("LostFoundAccessService (reserved items)", () => {
  it("shows an item reserved for a staff member only to them and the desk", async () => {
    const rules = access();
    const item = kept({ ownerUserId: "porter-2" });
    expect(await rules.canSee(who("porter-2"), item)).toBe(true);
    expect(await rules.canSee(who("gate-1"), item)).toBe(true);
    expect(await rules.canSee(who("resident-1"), item)).toBe(false);
    expect(await rules.isOwner(who("porter-2"), item)).toBe(true);
    expect(await rules.isOwner(who("resident-1"), item)).toBe(false);
    expect(await rules.ownerAudience(item)).toEqual(["porter-2"]);
  });

  it("keeps the unit and resident reservations as they were", async () => {
    const rules = access();
    const forUnit = kept({ ownerUnitId: "unit-1" });
    expect(await rules.canSee(who("resident-2"), forUnit)).toBe(true);
    expect(await rules.canSee(who("resident-3"), forUnit)).toBe(false);
    expect(await rules.ownerAudience(forUnit)).toEqual([
      "resident-1",
      "resident-2",
    ]);

    const forResident = kept({
      ownerUnitId: "unit-1",
      ownerUserId: "resident-1",
    });
    expect(await rules.canSee(who("resident-1"), forResident)).toBe(true);
    expect(await rules.canSee(who("resident-2"), forResident)).toBe(false);
    expect(await rules.ownerAudience(forResident)).toEqual(["resident-1"]);
  });

  it("shows an item nobody reserved to everyone", async () => {
    const rules = access();
    expect(await rules.canSee(who("resident-3"), kept())).toBe(true);
    expect(await rules.ownerAudience(kept())).toEqual([]);
  });
});
