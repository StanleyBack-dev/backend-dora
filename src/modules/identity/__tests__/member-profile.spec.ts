import {
  MemberKind,
  normalizeEmployee,
  profileUnitId,
  residentProfile,
} from "@/modules/identity/domain/member-profile";

const TODAY = "2026-11-16";

describe("member profile", () => {
  it("cleans the employee record and keeps empty fields as null", () => {
    expect(
      normalizeEmployee(
        {
          jobTitle: "  Porteiro   noturno ",
          hiredOn: "2024-02-29",
          workShift: "",
          contractor: null,
        },
        TODAY,
      ),
    ).toEqual({
      kind: MemberKind.EMPLOYEE,
      jobTitle: "Porteiro noturno",
      hiredOn: "2024-02-29",
      workShift: null,
      contractor: null,
    });
  });

  it("rejects a future, unreal or malformed hiring date", () => {
    for (const hiredOn of [
      "2026-11-17",
      "2025-02-29",
      "16/11/2026",
      "1949-12-31",
    ]) {
      expect(normalizeEmployee({ hiredOn }, TODAY)).toEqual({
        violation: "hiredOn",
      });
    }
    expect(normalizeEmployee({ hiredOn: TODAY }, TODAY)).toMatchObject({
      hiredOn: TODAY,
    });
  });

  it("enforces the text limits", () => {
    expect(normalizeEmployee({ jobTitle: "x".repeat(61) }, TODAY)).toEqual({
      violation: "jobTitle",
    });
    expect(normalizeEmployee({ workShift: "x".repeat(81) }, TODAY)).toEqual({
      violation: "workShift",
    });
    expect(normalizeEmployee({ contractor: "x".repeat(121) }, TODAY)).toEqual({
      violation: "contractor",
    });
  });

  it("gives a unit only to residents", () => {
    expect(profileUnitId(residentProfile("unit-1", "fundos"))).toBe("unit-1");
    const employee = normalizeEmployee({}, TODAY);
    if ("violation" in employee) throw new Error("unexpected");
    expect(profileUnitId(employee)).toBeNull();
  });
});
