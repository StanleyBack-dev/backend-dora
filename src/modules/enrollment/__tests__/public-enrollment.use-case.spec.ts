import { createHmac, timingSafeEqual } from "crypto";
import { AppException } from "@/common/exceptions/app-exception";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { PublicEnrollmentUseCase } from "@/modules/enrollment/application/use-cases/public-enrollment.use-case";
import type { EnrollmentRepositoryPort } from "@/modules/enrollment/application/ports/enrollment-repository.port";
import type { EnrollmentInvite } from "@/modules/enrollment/domain/enrollment";
import type { SecretsPort } from "@/modules/identity/application/ports/secrets.port";
import type { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { RateLimitPort } from "@/shared/application/ports/rate-limit.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";
import { SharpImageProcessor } from "@/shared/infrastructure/sharp-image-processor";
import sharp from "sharp";

const NOW = new Date("2026-10-25T12:00:00Z");

const secrets: SecretsPort = {
  randomToken: () => "token",
  numericCode: () => "123456",
  temporaryPassword: () => "Temp-123",
  digest: (value) => createHmac("sha256", "test").update(value).digest("hex"),
  sameDigest: (a, b) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
};

type Setup = {
  invite?: Partial<EnrollmentInvite>;
  /** Active managers of the condominium. */
  managers?: string[];
  units?: { id: string; block: string; number: string }[];
  status?: "ACTIVE" | "SUSPENDED";
};

function setup(options: Setup = {}) {
  let now = NOW;
  const units = options.units ?? [];
  const stored: EnrollmentInvite = {
    id: "invite-1",
    condominiumId: "condo-1",
    code: "123456",
    label: "Bloco A",
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    createdBy: "admin",
    createdAt: NOW,
    requestCount: 0,
    ...options.invite,
  };
  const created: unknown[] = [];
  const notices: OutboxDraft[] = [];
  let kicks = 0;
  const repository = {
    findOpenInviteByCode: async (code: string) =>
      code === stored.code && !stored.revokedAt ? stored : null,
    findInvite: async (id: string) => (id === stored.id ? stored : null),
    findPending: async () => null,
    createRequest: async (
      data: unknown,
      drafts: (requestId: string) => OutboxDraft[],
    ) => {
      created.push(data);
      notices.push(...drafts("request-1"));
      return data;
    },
  } as unknown as EnrollmentRepositoryPort;
  const limits: RateLimitPort = {
    hit: async () => ({ count: 1, resetAt: new Date(NOW.getTime() + 60_000) }),
    peek: async () => null,
    purgeEndedBefore: async () => 0,
  };
  const users = {
    isMemberEmail: async () => false,
    activeMemberIds: async (condominiumId: string) =>
      condominiumId === "condo-1"
        ? (options.managers ?? ["manager-1", "manager-2"])
        : [],
    activeUserIdsInGroup: async () => ["master-1"],
  } as unknown as UserLookupService;
  const condominiums = {
    find: async (id: string) =>
      id === "condo-1"
        ? {
            id,
            name: "Residencial Aurora",
            status: options.status ?? "ACTIVE",
          }
        : null,
    unitsOf: async () => units,
    unitIn: async (_condominiumId: string, unitId: string) =>
      units.find((unit) => unit.id === unitId) ?? null,
  } as unknown as CondominiumLookupService;
  const files: { key: string; type: string; bytes: number }[] = [];
  const storage = {
    put: async (key: string, body: Buffer, type: string) => {
      files.push({ key, type, bytes: body.length });
    },
    deleteMany: async () => {},
  } as unknown as ObjectStoragePort;
  const useCase = new PublicEnrollmentUseCase(
    repository,
    secrets,
    { now: () => now } as unknown as ClockPort,
    limits,
    new SharpImageProcessor(),
    storage,
    users,
    { kick: () => (kicks += 1) } as unknown as OutboxDispatcher,
    condominiums,
  );
  return {
    useCase,
    created,
    notices,
    kicks: () => kicks,
    files,
    stored,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

const form = {
  fullName: "joão DA silva",
  email: "Joao@Example.com",
  phone: "(62) 99999-1234",
};

describe("PublicEnrollmentUseCase", () => {
  it("turns a valid code into a form token that sends the form", async () => {
    const { useCase, created } = setup();
    const token = await useCase.verify("123456", "1.1.1.1");
    await useCase.submit(token, form, true, "1.1.1.1");
    expect(created).toEqual([
      expect.objectContaining({
        fullName: "João da Silva",
        email: "joao@example.com",
        phone: "62999991234",
        inviteId: "invite-1",
        condominiumId: "condo-1",
        unitId: null,
      }),
    ]);
  });

  it("tells the form which condominium and units it is for", async () => {
    const { useCase } = setup({
      units: [
        { id: "unit-1", block: "Bloco A", number: "101" },
        { id: "unit-2", block: "", number: "Casa 3" },
      ],
    });
    const token = await useCase.verify("123456", null);
    await expect(useCase.form(token)).resolves.toEqual({
      condominiumName: "Residencial Aurora",
      units: [
        { id: "unit-1", label: "Bloco A · 101" },
        { id: "unit-2", label: "Casa 3" },
      ],
    });
  });

  it("requires a unit of the condominium when it has units", async () => {
    const { useCase, created } = setup({
      units: [{ id: "unit-1", block: "A", number: "101" }],
    });
    const token = await useCase.verify("123456", null);
    await expect(useCase.submit(token, form, true, null)).rejects.toThrow(
      "Escolha a sua unidade",
    );
    await expect(
      useCase.submit(token, { ...form, unitId: "other" }, true, null),
    ).rejects.toThrow("Escolha a sua unidade");
    await useCase.submit(token, { ...form, unitId: "unit-1" }, true, null);
    expect(created).toEqual([expect.objectContaining({ unitId: "unit-1" })]);
  });

  it("takes no sign-up for a suspended condominium", async () => {
    const { useCase } = setup({ status: "SUSPENDED" });
    await expect(useCase.verify("123456", null)).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it("falls back to the platform when the condominium has no manager", async () => {
    const { useCase, notices } = setup({ managers: [] });
    const token = await useCase.verify("123456", null);
    await useCase.submit(token, form, true, null);
    expect(notices).toEqual([
      expect.objectContaining({ dedupeKey: "enrollment:request-1:master-1" }),
    ]);
  });

  it("notifies the condominium's managers by app and e-mail", async () => {
    const { useCase, notices, kicks } = setup();
    const token = await useCase.verify("123456", null);
    await useCase.submit(token, form, true, null);
    expect(notices).toEqual([
      expect.objectContaining({
        topic: "notification.deliver",
        dedupeKey: "enrollment:request-1:manager-1",
        payload: expect.objectContaining({
          userId: "manager-1",
          type: "ENROLLMENT_SUBMITTED",
          link: "/admin/cadastros",
          email: expect.objectContaining({ ctaLabel: "Analisar cadastro" }),
        }),
      }),
      expect.objectContaining({
        dedupeKey: "enrollment:request-1:manager-2",
      }),
    ]);
    expect(kicks()).toBe(1);
  });

  it("rejects a wrong code", async () => {
    const { useCase } = setup();
    await expect(useCase.verify("000000", null)).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it("rejects a tampered or expired form token", async () => {
    const { useCase, advance } = setup();
    const token = await useCase.verify("123456", null);
    const [payload] = token.split(".");
    await expect(
      useCase.submit(`${payload}.forged`, form, true, null),
    ).rejects.toBeInstanceOf(AppException);

    advance(61 * 60_000);
    await expect(useCase.submit(token, form, true, null)).rejects.toThrow(
      "O tempo para preencher o formulário acabou",
    );
  });

  it("stops the form when the invite is revoked", async () => {
    const { useCase, stored } = setup();
    const token = await useCase.verify("123456", null);
    stored.revokedAt = NOW;
    await expect(
      useCase.submit(token, form, true, null),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("requires consent and a valid phone", async () => {
    const { useCase } = setup();
    const token = await useCase.verify("123456", null);
    await expect(
      useCase.submit(token, form, false, null),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      useCase.submit(token, { ...form, phone: "1234" }, true, null),
    ).rejects.toThrow("Telefone inválido");
  });

  describe("profile photo", () => {
    const png = () =>
      sharp({
        create: { width: 900, height: 600, channels: 3, background: "#2a6" },
      })
        .png()
        .withMetadata({ exif: { IFD0: { Copyright: "secret gps" } } })
        .toBuffer();

    it("stores a valid photo re-encoded as a 512px WebP", async () => {
      const { useCase, created, files } = setup();
      const token = await useCase.verify("123456", null);
      const photo = (await png()).toString("base64");
      await useCase.submit(token, form, true, null, photo);
      expect(files).toHaveLength(1);
      expect(files[0]?.type).toBe("image/webp");
      expect(files[0]?.key).toMatch(
        /^profile-photos\/enrollment\/[0-9a-f-]{36}\.webp$/,
      );
      expect(created[0]).toEqual(
        expect.objectContaining({ photoKey: files[0]?.key }),
      );
    });

    it.each([
      [
        "SVG",
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ).toString("base64"),
      ],
      [
        "text named as an image",
        Buffer.from("not an image").toString("base64"),
      ],
      ["not base64", "%%%"],
    ])("rejects %s without storing anything", async (_label, photo) => {
      const { useCase, created, files } = setup();
      const token = await useCase.verify("123456", null);
      await expect(
        useCase.submit(token, form, true, null, photo),
      ).rejects.toThrow("JPEG, PNG ou WebP");
      expect(files).toHaveLength(0);
      expect(created).toHaveLength(0);
    });

    it("rejects a GIF and files over 2 MB", async () => {
      const { useCase } = setup();
      const token = await useCase.verify("123456", null);
      const gif = await sharp({
        create: { width: 10, height: 10, channels: 3, background: "#000" },
      })
        .gif()
        .toBuffer();
      await expect(
        useCase.submit(token, form, true, null, gif.toString("base64")),
      ).rejects.toThrow("JPEG, PNG ou WebP");
      const big = Buffer.alloc(2 * 1024 * 1024 + 10, 1).toString("base64");
      await expect(
        useCase.submit(token, form, true, null, big),
      ).rejects.toThrow("JPEG, PNG ou WebP");
    });

    it("drops the metadata of the original", async () => {
      const output = await new SharpImageProcessor().profilePhoto(await png());
      expect(output).not.toBeNull();
      const meta = await sharp(output!.data).metadata();
      expect(meta.format).toBe("webp");
      expect([meta.width, meta.height]).toEqual([512, 512]);
      expect(meta.exif).toBeUndefined();
    });
  });
});
