import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { DependentLookupService } from "@/modules/dependents/application/dependent-lookup.service";
import { DependentRelationship } from "@/modules/dependents/domain/dependent";
import type {
  ResidentEntry,
  UserLookupService,
} from "@/modules/identity/application/user-lookup.service";
import { ListResidentsUseCase } from "@/modules/residents-directory/application/use-cases/list-residents.use-case";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";

const actor = {
  id: "gate-1",
  condominiumId: "condo-1",
} as unknown as AuthenticatedUser;

const resident = (overrides: Partial<ResidentEntry> = {}): ResidentEntry => ({
  userId: "user-1",
  membershipId: "membership-1",
  name: "Maria Souza",
  phone: "11987654321",
  avatarKey: "avatars/maria.webp",
  unitId: "unit-1",
  unitStreet: null,
  unitBlock: "Bloco A",
  unitNumber: "101",
  unitComplement: null,
  ...overrides,
});

function setup(entries: ResidentEntry[]) {
  const asked: unknown[] = [];
  const users = {
    residents: async (condominiumId: string, filter: unknown) => {
      asked.push({ condominiumId, filter });
      return {
        items: entries,
        total: entries.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
    },
    residentNames: async () => [{ id: "user-1", name: "Maria Souza" }],
  } as unknown as UserLookupService;
  const dependents = {
    approvedOfMany: async () =>
      new Map([
        [
          "membership-1",
          [
            {
              id: "dep-1",
              name: "Pedro Souza",
              birthDate: "2015-03-01",
              relationship: DependentRelationship.CHILD,
            },
          ],
        ],
      ]),
  } as unknown as DependentLookupService;
  const storage = {
    signedReadUrl: async (key: string) => `https://files/${key}`,
  } as unknown as ObjectStoragePort;
  return {
    useCase: new ListResidentsUseCase(users, dependents, storage),
    asked,
  };
}

describe("ListResidentsUseCase", () => {
  it("lists residents with unit, phone, photo and approved dependents", async () => {
    const { useCase, asked } = setup([resident()]);
    const page = await useCase.list(
      actor,
      { unitId: "unit-1" },
      { page: 1, limit: 20 },
    );
    expect(asked[0]).toEqual({
      condominiumId: "condo-1",
      filter: { unitId: "unit-1" },
    });
    expect(page.items[0]).toEqual({
      userId: "user-1",
      name: "Maria Souza",
      photoUrl: "https://files/avatars/maria.webp",
      unitId: "unit-1",
      unitLabel: "Bloco A · 101",
      unitComplement: null,
      phone: "11987654321",
      dependents: [
        {
          id: "dep-1",
          name: "Pedro Souza",
          relationship: DependentRelationship.CHILD,
        },
      ],
    });
  });

  it("never exposes a dependent's birth date", async () => {
    const { useCase } = setup([resident()]);
    const page = await useCase.list(actor, {}, { page: 1, limit: 20 });
    expect(page.items[0].dependents[0]).not.toHaveProperty("birthDate");
  });

  it("handles a resident without unit or photo", async () => {
    const { useCase } = setup([
      resident({
        membershipId: "membership-2",
        avatarKey: null,
        unitId: null,
        unitBlock: null,
        unitNumber: null,
      }),
    ]);
    const page = await useCase.list(actor, {}, { page: 1, limit: 20 });
    expect(page.items[0]).toMatchObject({
      photoUrl: null,
      unitLabel: null,
      dependents: [],
    });
  });
});
