import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AppException } from "@/common/exceptions/app-exception";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import type {
  NewParcel,
  Parcel,
  ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import { RegisterParcelUseCase } from "@/modules/parcels/application/use-cases/register-parcel.use-case";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ImageProcessorPort } from "@/shared/application/ports/image-processor.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";

const actor = { id: "staff-1" } as AuthenticatedUser;

function setup() {
  const created: NewParcel[] = [];
  const told: string[][] = [];
  const parcels = {
    findByCode: async () => null,
    create: async (
      parcel: NewParcel,
      notices: (parcel: Parcel) => { payload: { userId: string } }[],
    ) => {
      created.push(parcel);
      const stored = { id: "parcel-1", ...parcel } as unknown as Parcel;
      told.push(notices(stored).map((notice) => notice.payload.userId));
      return stored;
    },
  } as unknown as ParcelRepositoryPort;
  const access = {
    condominiumOf: async () => "condo-1",
  } as unknown as ParcelAccessService;
  const condominiums = {
    unitIn: async () => ({ id: "unit-1" }),
  } as unknown as CondominiumLookupService;
  const users = {
    activeUnitMemberIds: async () => ["resident-1", "resident-2"],
  } as unknown as UserLookupService;
  const clock = {
    now: () => new Date("2026-11-20T12:00:00Z"),
    timeZone: "America/Sao_Paulo",
  } as ClockPort;
  return {
    useCase: new RegisterParcelUseCase(
      parcels,
      access,
      condominiums,
      users,
      {} as ImageProcessorPort,
      {} as ObjectStoragePort,
      clock,
    ),
    created,
    told,
  };
}

describe("RegisterParcelUseCase", () => {
  it("registers with the carrier and where it is kept", async () => {
    const { useCase, created } = setup();
    await useCase.execute(actor, {
      unitId: "unit-1",
      carrier: " Correios ",
      storageLocation: "Portaria",
    });
    expect(created[0]).toMatchObject({
      unitId: "unit-1",
      carrier: "Correios",
      storageLocation: "Portaria",
      receivedBy: "staff-1",
    });
  });

  it("requires the carrier and where it is kept", async () => {
    const { useCase, created } = setup();
    await expect(
      useCase.execute(actor, { unitId: "unit-1", storageLocation: "Portaria" }),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      useCase.execute(actor, { unitId: "unit-1", carrier: "Correios" }),
    ).rejects.toBeInstanceOf(AppException);
    expect(created).toHaveLength(0);
  });

  it("tells every resident of the unit when chosen by the unit", async () => {
    const { useCase, told } = setup();
    await useCase.execute(actor, {
      unitId: "unit-1",
      carrier: "Correios",
      storageLocation: "Portaria",
    });
    expect(told[0]).toEqual(["resident-1", "resident-2"]);
  });

  it("tells only the resident chosen by name (a surprise stays private)", async () => {
    const { useCase, created, told } = setup();
    await useCase.execute(actor, {
      unitId: "unit-1",
      recipientUserId: "resident-2",
      carrier: "Amazon",
      storageLocation: "Portaria",
    });
    expect(created[0].recipientUserId).toBe("resident-2");
    expect(told[0]).toEqual(["resident-2"]);
  });

  it("refuses a resident who does not live in the unit", async () => {
    const { useCase, created } = setup();
    await expect(
      useCase.execute(actor, {
        unitId: "unit-1",
        recipientUserId: "someone-else",
        carrier: "Amazon",
        storageLocation: "Portaria",
      }),
    ).rejects.toBeInstanceOf(AppException);
    expect(created).toHaveLength(0);
  });
});
