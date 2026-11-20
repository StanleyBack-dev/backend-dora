import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { SearchParcelRecipientsUseCase } from "@/modules/parcels/application/use-cases/search-parcel-recipients.use-case";

const actor = { id: "staff-1" } as AuthenticatedUser;

function setup() {
  const searched: string[] = [];
  const access = {
    condominiumOf: async () => "condo-1",
  } as unknown as ParcelAccessService;
  const users = {
    searchResidents: async (_condo: string, term: string) => {
      searched.push(term);
      return [
        { userId: "u1", name: "Maria Souza", unitId: "unit-1" },
        { userId: "u2", name: "Mário Lima", unitId: "unit-gone" },
      ];
    },
  } as unknown as UserLookupService;
  const condominiums = {
    unitLabels: async () => new Map([["unit-1", "A · 101"]]),
  } as unknown as CondominiumLookupService;
  return {
    useCase: new SearchParcelRecipientsUseCase(access, users, condominiums),
    searched,
  };
}

describe("SearchParcelRecipientsUseCase", () => {
  it("returns residents with their unit label, skipping units not found", async () => {
    const { useCase, searched } = setup();
    expect(await useCase.execute(actor, "  mar   ")).toEqual([
      {
        userId: "u1",
        name: "Maria Souza",
        unitId: "unit-1",
        unitLabel: "A · 101",
      },
    ]);
    expect(searched).toEqual(["mar"]);
  });

  it("does not search with less than 2 characters", async () => {
    const { useCase, searched } = setup();
    expect(await useCase.execute(actor, " m ")).toEqual([]);
    expect(searched).toEqual([]);
  });
});
