import { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  BroadcastAudience,
  normalizeBroadcast,
} from "@/modules/broadcasts/domain/broadcast";

const base = {
  title: "  Manutenção   da piscina  ",
  body: "  A piscina fecha no sábado.\n\n\n\nVoltamos no domingo.  ",
  audience: BroadcastAudience.TODOS,
  sendEmail: true,
};

describe("normalizeBroadcast", () => {
  it("trims, collapses spaces and extra blank lines", () => {
    expect(normalizeBroadcast(base)).toEqual({
      title: "Manutenção da piscina",
      body: "A piscina fecha no sábado.\n\nVoltamos no domingo.",
      audience: BroadcastAudience.TODOS,
      targetGroup: null,
      sendEmail: true,
    });
  });

  it("keeps the target group only for the GRUPO audience", () => {
    expect(
      normalizeBroadcast({ ...base, targetGroup: UserGroup.ADMIN }),
    ).toMatchObject({ targetGroup: null });
    expect(
      normalizeBroadcast({
        ...base,
        audience: BroadcastAudience.GRUPO,
        targetGroup: UserGroup.ADMIN,
      }),
    ).toMatchObject({ targetGroup: UserGroup.ADMIN });
  });

  it.each([
    [{ title: "Oi" }, "title-length"],
    [{ title: "x".repeat(121) }, "title-length"],
    [{ body: "  " }, "body-length"],
    [{ body: "x".repeat(2001) }, "body-length"],
    [{ audience: BroadcastAudience.GRUPO }, "group-required"],
  ] as const)("refuses %j (%s)", (override, violation) => {
    expect(normalizeBroadcast({ ...base, ...override })).toBe(violation);
  });
});
