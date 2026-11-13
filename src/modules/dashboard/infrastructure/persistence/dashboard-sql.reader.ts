import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  Dashboard,
  DashboardReaderPort,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";

// Reporting query: reads (never writes) the tables of identity, enrollment,
// condominiums, support and outbox in a single statement. Support and outbox
// are the platform's, so only the platform administrator gets them.
@Injectable()
export class DashboardSqlReader implements DashboardReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(condominiumId: string, platform: boolean): Promise<Dashboard> {
    const [row] = await this.dataSource.query<Dashboard[]>(
      `SELECT
         (SELECT count(*)::int FROM tb_memberships m
            JOIN tb_users u ON u.idtb_users = m.idtb_users
           WHERE m.idtb_condominiums = $1 AND m.active AND u.active)
           AS "activeUsers",
         (SELECT count(*)::int FROM tb_enrollment_requests
           WHERE idtb_condominiums = $1 AND status = 'PENDENTE')
           AS "pendingEnrollments",
         (SELECT count(*)::int FROM tb_units WHERE idtb_condominiums = $1)
           AS "units",
         CASE WHEN $2 THEN (SELECT count(*)::int FROM tb_support_requests
           WHERE status = 'ABERTO') END AS "openSupportRequests",
         CASE WHEN $2 THEN (SELECT count(*)::int FROM tb_outbox
           WHERE status = 'FAILED') END AS "failedNotifications"`,
      [condominiumId, platform],
    );
    return row as Dashboard;
  }
}
