import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { DashboardUseCase } from "@/modules/dashboard/application/dashboard.use-case";
import type {
  DashboardReaderPort,
  ParcelIndicators,
  ParcelIndicatorsWindow,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const now = new Date("2026-11-20T12:00:00Z");
const actor = {
  id: "manager-1",
  condominiumId: "condo-1",
  platformAdmin: false,
} as unknown as AuthenticatedUser;

const indicators: ParcelIndicators = {
  waiting: 3,
  stuck: 1,
  perishableOverdue: 0,
  pickedUpLast30Days: 10,
  averagePickupHours: 18.5,
  monthly: [],
};

function setup(modules: AppModule[]) {
  const windows: ParcelIndicatorsWindow[] = [];
  const reader = {
    read: async () => ({ units: 4 }),
    parcels: async (_condominiumId: string, window: ParcelIndicatorsWindow) => {
      windows.push(window);
      return indicators;
    },
  } as unknown as DashboardReaderPort;
  const clock = {
    now: () => now,
    timeZone: "America/Sao_Paulo",
    localDate: () => "2026-11-20",
    startOfLocalDate: () => now,
    startOfNextLocalDay: () => now,
  } as unknown as ClockPort;
  const access = {
    enabled: async () => modules,
  } as unknown as ModuleAccessService;
  return { useCase: new DashboardUseCase(reader, clock, access), windows };
}

describe("DashboardUseCase", () => {
  it("adds the parcels indicators where the module is on", async () => {
    const { useCase, windows } = setup([AppModule.PARCELS]);
    const dashboard = await useCase.get(actor);
    expect(dashboard.parcels).toEqual(indicators);
    expect(windows[0].stuckBefore).toEqual(new Date("2026-11-17T12:00:00Z"));
    expect(windows[0].since30Days).toEqual(new Date("2026-10-21T12:00:00Z"));
    expect(windows[0].timeZone).toBe("America/Sao_Paulo");
  });

  it("leaves them out where the module is off", async () => {
    const { useCase, windows } = setup([AppModule.BOOKINGS]);
    const dashboard = await useCase.get(actor);
    expect(dashboard.parcels).toBeNull();
    expect(windows).toHaveLength(0);
  });
});
