import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { ParcelsMaintenanceService } from "@/modules/parcels/application/parcels-maintenance.service";
import type {
  Parcel,
  ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";

const now = new Date("2026-11-20T12:00:00Z");

const parcel = (overrides: Partial<Parcel> = {}) =>
  ({
    id: "parcel-1",
    condominiumId: "condo-1",
    unitId: "unit-1",
    recipientName: null,
    carrier: "iFood",
    trackingCode: null,
    pickupCode: "ABC234",
    receivedAt: new Date("2026-11-20T08:00:00Z"),
    perishable: true,
    pickupDeadline: new Date("2026-11-20T16:00:00Z"),
    perishableRemindedAt: null,
    ...overrides,
  }) as Parcel;

function setup(found: { reminders?: Parcel[]; overdue?: Parcel[] }) {
  const reminded: {
    id: string;
    previous: Date | null;
    notices: OutboxDraft[];
  }[] = [];
  const overdue: { id: string; notices: OutboxDraft[] }[] = [];
  const parcels = {
    duePerishableReminders: async () => found.reminders ?? [],
    markPerishableReminded: async (
      id: string,
      _at: Date,
      previous: Date | null,
      notices: OutboxDraft[],
    ) => {
      reminded.push({ id, previous, notices });
      return true;
    },
    dueOverdue: async () => found.overdue ?? [],
    markOverdueNotified: async (
      id: string,
      _at: Date,
      notices: OutboxDraft[],
    ) => {
      overdue.push({ id, notices });
      return true;
    },
  } as unknown as ParcelRepositoryPort;
  const modules = {
    enabled: async () => [AppModule.PARCELS],
  } as unknown as ModuleAccessService;
  const access = {
    audience: async () => ["resident-1"],
  } as unknown as ParcelAccessService;
  const clock = { now: () => now, timeZone: "America/Sao_Paulo" } as ClockPort;
  return {
    service: new ParcelsMaintenanceService(
      parcels,
      modules,
      access,
      {} as ObjectStoragePort,
      clock,
    ),
    reminded,
    overdue,
  };
}

describe("ParcelsMaintenanceService.runPerishable", () => {
  it("reminds the residents of a perishable parcel with the deadline", async () => {
    const waiting = parcel({
      perishableRemindedAt: new Date("2026-11-20T09:00:00Z"),
    });
    const { service, reminded } = setup({ reminders: [waiting] });
    await expect(service.runPerishable(now)).resolves.toEqual({
      reminders: 1,
      overdue: 0,
    });
    expect(reminded[0].previous).toEqual(waiting.perishableRemindedAt);
    const payload = reminded[0].notices[0].payload as {
      userId: string;
      body: string;
    };
    expect(payload.userId).toBe("resident-1");
    expect(payload.body).toContain("retire até");
  });

  it("tells once when the deadline passed", async () => {
    const { service, overdue } = setup({
      overdue: [parcel({ pickupDeadline: new Date("2026-11-20T11:00:00Z") })],
    });
    await expect(service.runPerishable(now)).resolves.toEqual({
      reminders: 0,
      overdue: 1,
    });
    expect(overdue[0].notices).toHaveLength(1);
  });
});
