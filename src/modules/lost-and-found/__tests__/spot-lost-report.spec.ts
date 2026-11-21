import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import type {
  LostReport,
  LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import { SpotLostReportUseCase } from "@/modules/lost-and-found/application/use-cases/spot-lost-report.use-case";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

const neighbour = { id: "resident-2", name: "Carlos" } as AuthenticatedUser;

const report = (overrides: Partial<LostReport> = {}) =>
  ({
    id: "report-1",
    userId: "resident-1",
    userName: "Maria",
    title: "Chave do carro",
    status: LostReportStatus.OPEN,
    shared: true,
    ...overrides,
  }) as LostReport;

function setup(found: LostReport | null) {
  const written: OutboxDraft[] = [];
  const spotters = new Set<string>();
  const reports = {
    find: async () => found,
    // Once per person: a second "Achei isso" writes nothing.
    spot: async (
      _report: string,
      userId: string,
      _note: string | null,
      notices: OutboxDraft[],
    ) => {
      if (spotters.has(userId)) return false;
      spotters.add(userId);
      written.push(...notices);
      return true;
    },
  } as unknown as LostReportRepositoryPort;
  const access = {
    condominiumOf: async () => "condo-1",
    staff: async () => ["gate-1", "resident-2"],
  } as unknown as LostFoundAccessService;
  const told = () =>
    written.map((notice) => {
      const payload = notice.payload as { userId: string; body: string };
      return payload.userId;
    });
  return { useCase: new SpotLostReportUseCase(reports, access), written, told };
}

describe("SpotLostReportUseCase", () => {
  it("tells the owner (not who) and the desk (who), not the finder", async () => {
    const { useCase, written, told } = setup(report());
    await useCase.spot(neighbour, "report-1", " Deixei na portaria ");
    expect(told()).toEqual(["resident-1", "gate-1"]);
    const [owner, desk] = written.map(
      (notice) => (notice.payload as { body: string }).body,
    );
    expect(owner).not.toContain("Carlos");
    expect(owner).toContain("Deixei na portaria");
    expect(desk).toContain("Carlos");
    // Once per neighbour and report.
    expect(written[0].dedupeKey).toBe(
      "lost-report:report-1:spotted:resident-2:owner",
    );
    await useCase.spot(neighbour, "report-1", null);
    expect(written).toHaveLength(2);
  });

  it("refuses one's own report, one not shared and one closed", async () => {
    for (const found of [
      report({ userId: "resident-2" }),
      report({ shared: false }),
      report({ status: LostReportStatus.FOUND }),
      null,
    ]) {
      const { useCase, written } = setup(found);
      await expect(useCase.spot(neighbour, "report-1", null)).rejects.toThrow(
        "não encontrado",
      );
      expect(written).toHaveLength(0);
    }
  });
});
