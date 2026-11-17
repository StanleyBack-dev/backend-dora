import { likePattern } from "@/shared/infrastructure/persistence/like-pattern";

describe("likePattern", () => {
  it("wraps the trimmed term for a contains search", () => {
    expect(likePattern("  ana ")).toBe("%ana%");
  });

  it("matches the typed wildcards literally", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
