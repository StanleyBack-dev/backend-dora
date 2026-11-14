import { AppException } from "@/common/exceptions/app-exception";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import type {
  UserPatch,
  UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import { UpdateOwnProfileUseCase } from "@/modules/identity/application/use-cases/update-own-profile.use-case";
import type { User } from "@/modules/identity/domain/user";
import { normalizePhone } from "@/shared/domain/phone";

const actor = { id: "user-1" } as AuthenticatedUser;

function setup() {
  let user = {
    id: "user-1",
    name: "Ana Souza",
    email: "ana@example.com",
    phone: "62999990000",
  } as User;
  const patches: UserPatch[] = [];
  const users = {
    findById: async () => user,
    findByEmail: async () => null,
    update: async (_id: string, patch: UserPatch) => {
      patches.push(patch);
      const defined = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );
      user = { ...user, ...defined } as User;
      return user;
    },
  } as unknown as UserRepositoryPort;
  const audit = {
    stamp: async () => undefined,
  } as unknown as AuditTrailService;
  return {
    useCase: new UpdateOwnProfileUseCase(users, audit),
    patches,
    current: () => user,
  };
}

const base = { name: "Ana Souza", email: "ana@example.com" };

describe("UpdateOwnProfileUseCase phone", () => {
  it("keeps the phone when it is not sent", async () => {
    const { useCase, current } = setup();
    await useCase.execute(actor, base);
    expect(current().phone).toBe("62999990000");
  });

  it("stores the digits of a formatted phone", async () => {
    const { useCase, current } = setup();
    await useCase.execute(actor, { ...base, phone: "+55 (11) 3333-4444" });
    expect(current().phone).toBe("1133334444");
  });

  it("removes the phone when sent empty", async () => {
    const { useCase, patches } = setup();
    await useCase.execute(actor, { ...base, phone: "  " });
    expect(patches[0]?.phone).toBeNull();
  });

  it("rejects a phone without the area code", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute(actor, { ...base, phone: "99999-0000" }),
    ).rejects.toBeInstanceOf(AppException);
  });
});

describe("normalizePhone", () => {
  it("accepts landlines and mobiles, with or without +55", () => {
    expect(normalizePhone("(62) 3333-4444")).toBe("6233334444");
    expect(normalizePhone("+55 62 99999-0000")).toBe("62999990000");
    expect(normalizePhone("123")).toBeNull();
  });
});
