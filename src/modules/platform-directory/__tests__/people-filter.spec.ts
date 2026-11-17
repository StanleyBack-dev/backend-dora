import { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  normalizePeopleFilter,
  searchPattern,
} from "@/modules/platform-directory/domain/people-filter";

describe("platform directory filter", () => {
  it("turns the text into an ILIKE pattern", () => {
    expect(searchPattern("  Ana   Souza ")).toBe("%Ana Souza%");
    expect(searchPattern("ana@ex")).toBe("%ana@ex%");
  });

  it("ignores a text too short to search", () => {
    expect(searchPattern("a")).toBeNull();
    expect(searchPattern("   ")).toBeNull();
    expect(searchPattern(null)).toBeNull();
  });

  it("escapes the wildcards typed", () => {
    expect(searchPattern("50%_off")).toBe("%50\\%\\_off%");
  });

  it("keeps the role and the condominium", () => {
    expect(
      normalizePeopleFilter({
        search: "x",
        role: UserGroup.CONCIERGE,
        condominiumId: "c-1",
      }),
    ).toEqual({
      pattern: null,
      role: UserGroup.CONCIERGE,
      condominiumId: "c-1",
    });
  });
});
