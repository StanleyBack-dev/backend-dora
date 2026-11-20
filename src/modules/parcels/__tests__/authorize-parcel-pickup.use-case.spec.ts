import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AppException } from "@/common/exceptions/app-exception";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import type {
  Parcel,
  ParcelAuthorization,
  ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import { AuthorizeParcelPickupUseCase } from "@/modules/parcels/application/use-cases/authorize-parcel-pickup.use-case";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import { DocumentType } from "@/shared/domain/identity-document";

const now = new Date("2026-11-20T12:00:00Z");
const actor = { id: "resident-1" } as AuthenticatedUser;

const waiting = (overrides: Partial<Parcel> = {}) =>
  ({
    id: "parcel-1",
    condominiumId: "condo-1",
    unitId: "unit-1",
    pickupCode: "ABC234",
    carrier: "Amazon",
    recipientName: null,
    unitLabel: "Bloco A · 101",
    trackingCode: null,
    receivedAt: now,
    pickupDeadline: null,
    status: ParcelStatus.RECEIVED,
    authorizedName: null,
    ...overrides,
  }) as Parcel;

function setup(parcel: Parcel, stillWaiting = true) {
  const saved: { authorization: ParcelAuthorization | null }[] = [];
  const told: string[][] = [];
  const parcels = {
    authorize: async (
      _id: string,
      authorization: ParcelAuthorization | null,
      _by: string,
      notices: (parcel: Parcel) => OutboxDraft[],
    ) => {
      if (!stillWaiting) return null;
      saved.push({ authorization });
      const updated = {
        ...parcel,
        authorizedName: authorization?.name ?? null,
        authorizedAt: authorization?.at ?? null,
        authorizedByName: "Ana",
      } as Parcel;
      told.push(
        notices(updated).map(
          (notice) => (notice.payload as { userId: string }).userId,
        ),
      );
      return updated;
    },
  } as unknown as ParcelRepositoryPort;
  const access = {
    loadVisible: async () => parcel,
    audience: async () => ["resident-1", "resident-2"],
  } as unknown as ParcelAccessService;
  const clock = { now: () => now, timeZone: "America/Sao_Paulo" } as ClockPort;
  return {
    useCase: new AuthorizeParcelPickupUseCase(parcels, access, clock),
    saved,
    told,
  };
}

describe("AuthorizeParcelPickupUseCase", () => {
  it("authorizes a person with a document and tells the others", async () => {
    const { useCase, saved, told } = setup(waiting());
    const parcel = await useCase.authorize(actor, "parcel-1", {
      name: "  Carlos   Souza ",
      documentType: DocumentType.CPF,
      document: "529.982.247-25",
    });
    expect(saved[0].authorization).toMatchObject({
      name: "Carlos Souza",
      documentType: DocumentType.CPF,
      document: "52998224725",
      by: "resident-1",
      at: now,
    });
    expect(parcel.authorizedName).toBe("Carlos Souza");
    // Not the one who authorized.
    expect(told[0]).toEqual(["resident-2"]);
  });

  it("refuses a short name or an invalid CPF", async () => {
    const { useCase, saved } = setup(waiting());
    await expect(
      useCase.authorize(actor, "parcel-1", { name: "Al" }),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      useCase.authorize(actor, "parcel-1", {
        name: "Carlos Souza",
        documentType: DocumentType.CPF,
        document: "111.111.111-11",
      }),
    ).rejects.toBeInstanceOf(AppException);
    expect(saved).toHaveLength(0);
  });

  it("refuses a parcel that is no longer waiting", async () => {
    const { useCase } = setup(waiting({ status: ParcelStatus.PICKED_UP }));
    await expect(
      useCase.authorize(actor, "parcel-1", { name: "Carlos Souza" }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("refuses when the parcel left while saving", async () => {
    const { useCase } = setup(waiting(), false);
    await expect(
      useCase.authorize(actor, "parcel-1", { name: "Carlos Souza" }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("removes an authorization, and does nothing when there is none", async () => {
    const authorized = setup(waiting({ authorizedName: "Carlos Souza" }));
    await authorized.useCase.revoke(actor, "parcel-1");
    expect(authorized.saved[0].authorization).toBeNull();

    const none = setup(waiting());
    await none.useCase.revoke(actor, "parcel-1");
    expect(none.saved).toHaveLength(0);
  });
});
