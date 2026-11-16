import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import {
  CondominiumStatus,
  type Condominium,
} from "@/modules/condominiums/domain/condominium";
import type { MembershipRepositoryPort } from "@/modules/identity/application/ports/membership-repository.port";
import type { SessionRepositoryPort } from "@/modules/identity/application/ports/session-repository.port";
import type {
  UserPatch,
  UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import { CondominiumContextUseCase } from "@/modules/identity/application/use-cases/condominium-context.use-case";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const condo = (id: string, status = CondominiumStatus.ACTIVE) =>
  ({ id, name: id, city: "Goiânia", state: "GO", status }) as Condominium;

function setup(options: {
  condominiums: Condominium[];
  /** Condominium ids with an active membership. */
  memberOf?: string[];
  fallback?: string | null;
}) {
  const patches: UserPatch[] = [];
  const sessions: (string | null)[] = [];
  const memberships = {
    find: async (_userId: string, condominiumId: string) =>
      options.memberOf?.includes(condominiumId)
        ? { id: `m-${condominiumId}`, active: true }
        : null,
    defaultCondominiumId: async () => options.fallback ?? null,
    listOpenable: async () => [],
    touchSelected: async () => undefined,
  } as unknown as MembershipRepositoryPort;
  const sessionRepo = {
    setCondominium: async (_id: string, condominiumId: string | null) => {
      sessions.push(condominiumId);
    },
  } as unknown as SessionRepositoryPort;
  const users = {
    update: async (_id: string, patch: UserPatch) => {
      patches.push(patch);
    },
  } as unknown as UserRepositoryPort;
  const clock = { now: () => new Date("2026-11-14T12:00:00Z") } as ClockPort;
  const lookup = {
    find: async (id: string) =>
      options.condominiums.find((item) => item.id === id) ?? null,
    listAll: async () => options.condominiums,
  } as unknown as CondominiumLookupService;
  return {
    useCase: new CondominiumContextUseCase(
      memberships,
      sessionRepo,
      users,
      clock,
      lookup,
      { enabled: async () => [] } as unknown as ModuleAccessService,
    ),
    patches,
    sessions,
  };
}

const resident = (lastCondominiumId: string | null) => ({
  id: "user-1",
  group: UserGroup.USER,
  lastCondominiumId,
});
const platform = (lastCondominiumId: string | null) => ({
  id: "admin",
  group: UserGroup.ADMIN_MASTER,
  lastCondominiumId,
});

describe("CondominiumContextUseCase.startingFor", () => {
  it("reopens the member's last condominium", async () => {
    const { useCase } = setup({
      condominiums: [condo("a"), condo("b")],
      memberOf: ["a", "b"],
      fallback: "a",
    });
    expect(await useCase.startingFor(resident("b"))).toEqual({
      id: "b",
      status: CondominiumStatus.ACTIVE,
    });
  });

  it("falls back when the member left or the condominium is suspended", async () => {
    const { useCase } = setup({
      condominiums: [condo("a"), condo("b", CondominiumStatus.SUSPENDED)],
      memberOf: ["a", "b"],
      fallback: "a",
    });
    expect((await useCase.startingFor(resident("b")))?.id).toBe("a");
    expect((await useCase.startingFor(resident("gone")))?.id).toBe("a");
    const left = setup({ condominiums: [condo("b")], fallback: null });
    expect(await left.useCase.startingFor(resident("b"))).toBeNull();
  });

  it("reopens any condominium for the platform administrator", async () => {
    const { useCase } = setup({
      condominiums: [condo("s", CondominiumStatus.SUSPENDED)],
    });
    expect(await useCase.startingFor(platform("s"))).toEqual({
      id: "s",
      status: CondominiumStatus.SUSPENDED,
    });
    expect(await useCase.startingFor(platform(null))).toBeNull();
  });
});

describe("CondominiumContextUseCase.switchTo", () => {
  const admin = {
    id: "admin",
    sessionId: "session-1",
    platformAdmin: true,
  } as AuthenticatedUser;

  it("remembers the condominium and the platform view", async () => {
    const { useCase, patches, sessions } = setup({
      condominiums: [condo("a")],
    });
    await useCase.switchTo(admin, "a");
    await useCase.switchTo(admin, null);
    expect(sessions).toEqual(["a", null]);
    expect(patches).toEqual([
      { lastCondominiumId: "a" },
      { lastCondominiumId: null },
    ]);
  });

  it("lists every condominium for the platform administrator", async () => {
    const { useCase } = setup({ condominiums: [condo("a"), condo("b")] });
    const list = await useCase.mine({ id: "admin", platformAdmin: true });
    expect(list.map((item) => [item.id, item.role])).toEqual([
      ["a", UserGroup.ADMIN_MASTER],
      ["b", UserGroup.ADMIN_MASTER],
    ]);
  });
});
