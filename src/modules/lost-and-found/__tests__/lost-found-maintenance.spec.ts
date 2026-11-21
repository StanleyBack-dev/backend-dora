import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import type { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { LostFoundMaintenanceService } from "@/modules/lost-and-found/application/lost-found-maintenance.service";
import type { FoundItemRepositoryPort } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import type {
  LostReport,
  LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";

const now = new Date("2026-11-20T03:00:00Z");

describe("LostFoundMaintenanceService (expired reports)", () => {
  it("ends old reports and tells whoever reported, where the module is on", async () => {
    const told: OutboxDraft[] = [];
    let expiredBefore: Date | null = null;
    const reports = {
      expire: async (before: Date) => {
        expiredBefore = before;
        return [
          {
            id: "r1",
            userId: "resident-1",
            title: "Chave",
            condominiumId: "on",
          },
          {
            id: "r2",
            userId: "resident-2",
            title: "Bolsa",
            condominiumId: "off",
          },
        ] as LostReport[];
      },
      releasePhotos: async () => [],
      notify: async (notices: OutboxDraft[]) => {
        told.push(...notices);
      },
    } as unknown as LostReportRepositoryPort;
    const service = new LostFoundMaintenanceService(
      {
        dueExpiry: async () => [],
        releasePhotos: async () => [],
      } as unknown as FoundItemRepositoryPort,
      reports,
      {
        enabled: async (condominiumId: string) =>
          condominiumId === "on" ? [AppModule.LOST_AND_FOUND] : [],
      } as unknown as ModuleAccessService,
      {} as LostFoundAccessService,
      { deleteMany: async () => undefined } as unknown as ObjectStoragePort,
      { now: () => now, timeZone: "America/Sao_Paulo" } as ClockPort,
    );

    const result = await service.run(now);

    expect(result.lostReports).toBe(2);
    expect(expiredBefore).toEqual(new Date("2026-08-22T03:00:00Z"));
    expect(
      told.map((notice) => (notice.payload as { userId: string }).userId),
    ).toEqual(["resident-1"]);
    expect(told[0].dedupeKey).toBe("lost-report:r1:expired");
  });
});
